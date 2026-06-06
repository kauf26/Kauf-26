/**
 * Simultaneous multi-marketplace publish engine.
 * Runs adapters in parallel via Promise.allSettled — one failure does not block others.
 */

import { db } from "../db";
import { productDrafts, publishJobs, publishTasks } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  resolveMarketplaceTargets,
  getEnabledMarketplaceIds,
} from "../config/marketplaces";
import {
  draftToPublishPayload,
  type DraftPublishPayload,
} from "../publishToMarketplaces";
import { publishOne } from "./adapters";
import type { FetchFn } from "./adapters/types";

export type MarketplaceOutcome = {
  marketplace: string;
  success: boolean;
  listingId?: string;
  message: string;
  dryRun?: boolean;
  error?: string;
};

export type PublishReport = {
  draftId: number;
  jobId?: number;
  title: string;
  marketplaces: string[];
  outcomes: MarketplaceOutcome[];
  succeeded: number;
  failed: number;
  dryRun: number;
};

export type PublishDraftOptions = {
  /** When true, POST to marketplaces immediately (CLI). When false, only queue DB tasks (API). */
  sync?: boolean;
  createJob?: boolean;
  fetchImpl?: FetchFn;
};

async function loadDraft(draftId: number) {
  const [draft] = await db
    .select()
    .from(productDrafts)
    .where(eq(productDrafts.id, draftId));
  return draft ?? null;
}

export async function publishToMarketplacesParallel(
  draft: DraftPublishPayload,
  marketplaceIds: string[],
  fetchImpl?: FetchFn
): Promise<MarketplaceOutcome[]> {
  const settled = await Promise.allSettled(
    marketplaceIds.map(async (marketplace) => {
      const result = await publishOne(marketplace, draft, fetchImpl);
      return {
        marketplace,
        success: result.success,
        listingId: result.listingId,
        message: result.message,
        dryRun: result.dryRun,
        error: result.success ? undefined : result.message,
      } satisfies MarketplaceOutcome;
    })
  );

  return settled.map((entry, i) => {
    const marketplace = marketplaceIds[i];
    if (entry.status === "fulfilled") return entry.value;
    const reason =
      entry.reason instanceof Error
        ? entry.reason.message
        : String(entry.reason);
    console.error(`[PublishEngine] ${marketplace} rejected:`, reason);
    return {
      marketplace,
      success: false,
      message: reason,
      error: reason,
    };
  });
}

async function createPublishJob(
  payload: DraftPublishPayload,
  marketplaceIds: string[]
): Promise<number> {
  const [job] = await db
    .insert(publishJobs)
    .values({ productData: payload })
    .returning();

  await db.insert(publishTasks).values(
    marketplaceIds.map((marketplaceId) => ({
      jobId: job.id,
      marketplaceId,
      status: "pending",
      attempts: 0,
    }))
  );

  return job.id;
}

function summarize(outcomes: MarketplaceOutcome[]): Pick<
  PublishReport,
  "outcomes" | "succeeded" | "failed" | "dryRun"
> {
  const succeeded = outcomes.filter((o) => o.success && !o.dryRun).length;
  const dryRun = outcomes.filter((o) => o.success && o.dryRun).length;
  const failed = outcomes.filter((o) => !o.success).length;
  return { outcomes, succeeded, failed, dryRun };
}

/**
 * Main entry: load draft, resolve marketplaces, publish in parallel (or queue).
 */
export async function publishDraft(
  draftId: number,
  marketplaceNames?: string[],
  options: PublishDraftOptions = {}
): Promise<PublishReport> {
  const draft = await loadDraft(draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const payload = draftToPublishPayload(draft);
  const marketplaces = resolveMarketplaceTargets(marketplaceNames);

  if (marketplaces.length === 0) {
    throw new Error(
      `No enabled marketplaces to publish. Enabled: ${getEnabledMarketplaceIds().join(", ")}`
    );
  }

  let jobId: number | undefined;
  if (options.createJob !== false) {
    jobId = await createPublishJob(payload, marketplaces);
  }

  let outcomes: MarketplaceOutcome[];

  if (options.sync) {
    outcomes = await publishToMarketplacesParallel(
      payload,
      marketplaces,
      options.fetchImpl
    );

    if (jobId != null) {
      const tasks = await db
        .select()
        .from(publishTasks)
        .where(eq(publishTasks.jobId, jobId));
      for (const o of outcomes) {
        const task = tasks.find((t) => t.marketplaceId === o.marketplace);
        if (!task) continue;
        await db
          .update(publishTasks)
          .set({
            status: o.success ? "completed" : "failed",
            errorMessage: o.success
              ? o.dryRun
                ? "dry_run"
                : null
              : o.error ?? o.message,
            updatedAt: new Date(),
            attempts: 1,
          })
          .where(eq(publishTasks.id, task.id));
      }
    }
  } else {
    outcomes = marketplaces.map((marketplace) => ({
      marketplace,
      success: true,
      message: "Queued for async worker",
    }));
  }

  const stats = summarize(outcomes);

  return {
    draftId,
    jobId,
    title: draft.title,
    marketplaces,
    ...stats,
  };
}

export function formatPublishReport(report: PublishReport): string {
  const lines = [
    `Draft #${report.draftId} "${report.title}"`,
    report.jobId != null ? `Job #${report.jobId}` : "",
    `Marketplaces: ${report.marketplaces.join(", ")}`,
    "—".repeat(48),
  ].filter(Boolean);

  for (const o of report.outcomes) {
    const icon = o.success ? (o.dryRun ? "○" : "✓") : "✗";
    const extra = o.listingId ? ` (id: ${o.listingId})` : "";
    lines.push(`${icon} ${o.marketplace}: ${o.message}${extra}`);
  }

  lines.push(
    "—".repeat(48),
    `Published: ${report.succeeded} | Dry-run: ${report.dryRun} | Failed: ${report.failed}`
  );
  return lines.join("\n");
}
