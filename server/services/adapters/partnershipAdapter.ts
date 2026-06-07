import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FormattedListing, MarketplaceAdapter } from "./types";
import {
  draftDescription,
  draftImageCount,
  draftPrice,
  draftSku,
  dryRunResult,
  hasEnv,
} from "./adapterUtils";

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
    imageCount: draftImageCount(draft),
    note: "Waiting for partnership API keys; images and price are ready.",
  };
}

export async function publishPartnershipListing(
  formatted: FormattedListing,
  marketplaceId: string,
  displayName: string,
  envKeys: string[],
  configured: boolean
): Promise<AdapterPublishResult> {
  const price = formatted.price ?? 0;
  const imageCount = formatted.imageCount ?? 0;

  if (!configured) {
    const missing = envKeys.filter((k) => !process.env[k]?.trim());
    console.log(
      `[Publish][${displayName}] Waiting for partnership API keys (missing: ${missing.join(", ") || "all"}); images (${imageCount}) and price ($${price}) are ready.`
    );
    return dryRunResult(
      marketplaceId,
      `${displayName}: Waiting for partnership API keys; images and price are ready.`,
      formatted
    );
  }

  console.log(
    `[Publish][${displayName}] Partnership API keys configured; live publish not yet implemented — dry run (images: ${imageCount}, price: $${price}).`
  );
  return dryRunResult(
    marketplaceId,
    `${displayName}: API keys configured; partnership live publish pending — dry run.`,
    formatted
  );
}

export function createPartnershipAdapter(
  id: string,
  displayName: string,
  envKeys: string[]
): MarketplaceAdapter {
  const isConfigured = () => hasEnv(...envKeys);

  return {
    id,
    format: (draft) => formatPartnershipListing(draft, id, displayName),
    publish: (formatted) =>
      publishPartnershipListing(
        formatted,
        id,
        displayName,
        envKeys,
        isConfigured()
      ),
    isConfigured,
  };
}
