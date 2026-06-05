/**
 * Publish queue: rate limiting, retries, structured logging.
 */

import { publishDraftToMarketplace, type DraftPublishPayload } from "./publishToMarketplaces";

const MAX_ATTEMPTS = Number(process.env.PUBLISH_MAX_ATTEMPTS ?? 3);
const RATE_LIMIT_MS = Number(process.env.PUBLISH_RATE_LIMIT_MS ?? 2000);

const lastPublishAt = new Map<string, number>();

export type QueueTaskInput = {
  taskId: number;
  jobId: number;
  marketplaceId: string;
  attempts: number;
  draft: DraftPublishPayload;
};

export type QueueTaskResult = {
  success: boolean;
  errorMessage?: string;
  listingId?: string;
  dryRun?: boolean;
};

async function waitForRateLimit(marketplaceId: string): Promise<void> {
  const last = lastPublishAt.get(marketplaceId) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastPublishAt.set(marketplaceId, Date.now());
}

export async function processPublishTask(
  task: QueueTaskInput
): Promise<QueueTaskResult> {
  const attempt = (task.attempts ?? 0) + 1;
  console.log(
    `[QueueManager] task=${task.taskId} job=${task.jobId} marketplace=${task.marketplaceId} attempt=${attempt}/${MAX_ATTEMPTS}`
  );

  if (attempt > MAX_ATTEMPTS) {
    return {
      success: false,
      errorMessage: `Max attempts (${MAX_ATTEMPTS}) exceeded`,
    };
  }

  try {
    await waitForRateLimit(task.marketplaceId);
    const result = await publishDraftToMarketplace(
      task.marketplaceId,
      task.draft
    );

    if (!result.success) {
      return { success: false, errorMessage: result.message };
    }

    console.log(
      `[QueueManager] task=${task.taskId} ok marketplace=${task.marketplaceId} dryRun=${result.dryRun} listingId=${result.listingId ?? "n/a"}`
    );

    return {
      success: true,
      listingId: result.listingId,
      dryRun: result.dryRun,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[QueueManager] task=${task.taskId} failed marketplace=${task.marketplaceId}:`,
      msg
    );
    return { success: false, errorMessage: msg };
  }
}

export { MAX_ATTEMPTS };
