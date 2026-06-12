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
import { registerMarketplaceListing } from "./inventoryService";
import {
  extractCategoryFromDraftAttributes,
  filterMarketplacesForProductCategory,
  eligibilityDraftFromPublishPayload,
  validateMarketplacesForDraft,
} from "./listingService";
import { draftPrice } from "./adapters/adapterUtils";
import { isInternationalChannelMarketplace } from "../../shared/marketplaceChannels";
import {
  getMarketplaceListingLanguage,
  translateListingTextFields,
} from "./translationService";

export type MarketplaceOutcome = {
  marketplace: string;
  success: boolean;
  listingId?: string;
  /** Direct link to the live/admin listing when the marketplace API provides one. */
  listingUrl?: string;
  /** Account/shop the listing was published under (store domain, shop ID, ...). */
  account?: string;
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
  /** When true (default), translate title/description for international channel marketplaces. */
  translateInternational?: boolean;
};

async function buildTranslatedPayloadForMarketplace(
  base: DraftPublishPayload,
  marketplaceId: string
): Promise<DraftPublishPayload> {
  if (!isInternationalChannelMarketplace(marketplaceId)) return base;

  const targetLang = getMarketplaceListingLanguage(marketplaceId);
  if (!targetLang || targetLang === "en") return base;

  const description = String(
    base.attributes.aiDescription ?? base.attributes.description ?? ""
  ).trim();

  const translated = await translateListingTextFields(
    { title: base.title, description },
    { targetLang }
  );

  if (!translated.applied) return base;

  const nextDescription =
    translated.listing.description ?? description;

  return {
    ...base,
    title: translated.listing.title ?? base.title,
    attributes: {
      ...base.attributes,
      aiDescription: nextDescription,
      description: nextDescription,
    },
  };
}

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
  fetchImpl?: FetchFn,
  options?: Pick<PublishDraftOptions, "translateInternational">
): Promise<MarketplaceOutcome[]> {
  const translateInternational = options?.translateInternational !== false;
  const settled = await Promise.allSettled(
    marketplaceIds.map(async (marketplace) => {
      const payload =
        translateInternational
          ? await buildTranslatedPayloadForMarketplace(draft, marketplace)
          : draft;
      const result = await publishOne(marketplace, payload, fetchImpl);
      return {
        marketplace,
        success: result.success,
        listingId: result.listingId,
        listingUrl: result.listingUrl,
        account: result.account,
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
/** Publish to every marketplace with enabledForPublishing: true */
export async function publishDraftToAll(
  draftId: number,
  options: PublishDraftOptions = {}
): Promise<PublishReport> {
  return publishDraft(draftId, undefined, options);
}

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
  let marketplaces = resolveMarketplaceTargets(marketplaceNames);

  const category = extractCategoryFromDraftAttributes(payload.attributes);
  const categoryContext = {
    title: payload.title,
    description: String(payload.attributes.description ?? ""),
    priceUsd: draftPrice(payload),
  };
  const listingDraft = eligibilityDraftFromPublishPayload(payload);

  if (marketplaceNames == null) {
    marketplaces = filterMarketplacesForProductCategory(
      marketplaces,
      category,
      categoryContext
    );
  } else {
    validateMarketplacesForDraft(marketplaces, listingDraft);
  }

  if (marketplaces.length === 0) {
    throw new Error(
      marketplaceNames == null
        ? `No enabled marketplaces support category "${category || "unknown"}".`
        : `No enabled marketplaces to publish. Enabled: ${getEnabledMarketplaceIds().join(", ")}`
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
      options.fetchImpl,
      { translateInternational: options.translateInternational }
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

    for (const o of outcomes) {
      if (!o.success) continue;
      try {
        await registerMarketplaceListing(
          draftId,
          o.marketplace,
          o.listingId ?? null,
          payload.sku
        );
      } catch (invErr) {
        console.error(
          `[PublishEngine] Inventory registration failed for ${o.marketplace}:`,
          invErr
        );
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
