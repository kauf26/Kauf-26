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
    note: "Waiting for partnership API keys; images and price are ready.",
  };
}

export async function publishPartnershipListing(
  formatted: FormattedListing,
  marketplaceId: string,
  displayName: string
): Promise<AdapterPublishResult> {
  const price = formatted.price ?? 0;
  const imageCount = formatted.imageCount ?? 0;
  console.log(
    `[Publish][${displayName}] Waiting for partnership API keys; images (${imageCount}) and price ($${price}) are ready.`
  );
  return dryRunResult(
    marketplaceId,
    `${displayName}: Waiting for partnership API keys; images and price are ready.`,
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
