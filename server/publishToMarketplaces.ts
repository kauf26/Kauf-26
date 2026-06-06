/**
 * Multi-marketplace publish — thin facade over publishEngine + adapters.
 */

import { publishOne } from "./services/adapters";
import { SUPPORTED_MARKETPLACE_IDS } from "./config/marketplaces";

export type DraftPublishPayload = {
  draftId: number;
  title: string;
  sku?: string | null;
  images: string[];
  attributes: Record<string, unknown>;
};

export type PublishResult = {
  marketplaceId: string;
  success: boolean;
  listingId?: string;
  message: string;
  dryRun: boolean;
};

export { SUPPORTED_MARKETPLACE_IDS };

export async function publishDraftToMarketplace(
  marketplaceId: string,
  draft: DraftPublishPayload
): Promise<PublishResult> {
  const result = await publishOne(marketplaceId, draft);
  return {
    marketplaceId: result.marketplaceId,
    success: result.success,
    listingId: result.listingId,
    message: result.message,
    dryRun: result.dryRun,
  };
}

export async function publishDraftToMarketplaces(
  draft: DraftPublishPayload,
  marketplaceIds: string[]
): Promise<PublishResult[]> {
  const settled = await Promise.allSettled(
    marketplaceIds.map((id) => publishDraftToMarketplace(id, draft))
  );
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          marketplaceId: marketplaceIds[i],
          success: false,
          dryRun: false,
          message:
            s.reason instanceof Error ? s.reason.message : String(s.reason),
        }
  );
}

export function draftToPublishPayload(draft: {
  id: number;
  title: string;
  sku?: string | null;
  images?: unknown;
  attributes?: unknown;
}): DraftPublishPayload {
  return {
    draftId: draft.id,
    title: draft.title,
    sku: draft.sku,
    images: Array.isArray(draft.images) ? (draft.images as string[]) : [],
    attributes:
      draft.attributes && typeof draft.attributes === "object"
        ? (draft.attributes as Record<string, unknown>)
        : {},
  };
}
