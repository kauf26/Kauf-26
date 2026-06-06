import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FormattedListing, MarketplaceAdapter } from "./types";
import { draftDescription, draftPrice, draftSku, dryRunResult } from "./adapterUtils";

export function formatPartnershipListing(
  draft: DraftPublishPayload,
  marketplaceId: string,
  displayName: string
): FormattedListing {
  const a = draft.attributes ?? {};
  return {
    marketplace: marketplaceId,
    displayName,
    title: draft.title,
    description: draftDescription(draft),
    price: draftPrice(draft),
    currency: "USD",
    sku: draftSku(draft),
    category: a.category ?? "",
    brand: a.brand ?? "",
    imageCount: draft.images?.length ?? 0,
    note: "Partnership API — manual listing required until integration is complete",
  };
}

export async function publishPartnershipListing(
  formatted: FormattedListing,
  marketplaceId: string,
  displayName: string
): Promise<AdapterPublishResult> {
  console.log(
    `[Publish][${displayName}] Partnership API — manual listing required`
  );
  return dryRunResult(
    marketplaceId,
    `${displayName}: Partnership API — manual listing required (dry-run success)`,
    formatted
  );
}

export function createPartnershipAdapter(
  id: string,
  displayName: string
): MarketplaceAdapter {
  return {
    id,
    format: (draft) => formatPartnershipListing(draft, id, displayName),
    publish: (formatted) => publishPartnershipListing(formatted, id, displayName),
    isConfigured: () => false,
  };
}
