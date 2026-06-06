import type { DraftPublishPayload } from "../../publishToMarketplaces";
import { draftPrice } from "./adapterUtils";
import type { AdapterPublishResult, FormattedListing } from "./types";

export function formatWebListing(
  draft: DraftPublishPayload,
  marketplaceId: string
): FormattedListing {
  return {
    marketplace: marketplaceId,
    title: draft.title,
    price: draftPrice(draft),
    note: "No public API — manual listing required",
  };
}

export async function publishToWebMarketplace(
  formatted: FormattedListing,
  marketplaceId: string
): Promise<AdapterPublishResult> {
  return {
    dryRun: true,
    listingId: `${marketplaceId}-manual-${Date.now()}`,
    message: `${marketplaceId} has no public API — export payload for manual listing`,
  };
}
