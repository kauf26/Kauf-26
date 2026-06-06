import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FormattedListing } from "./types";

export function formatWebListing(
  draft: DraftPublishPayload,
  marketplaceId: string
): FormattedListing {
  const a = draft.attributes ?? {};
  const market = (a.marketPrices as Record<string, string>) ?? {};
  return {
    marketplace: marketplaceId,
    title: draft.title,
    price: parseFloat(market.recommendedPrice ?? String(a.medianPrice ?? "0")) || 0,
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
