/**
 * Etsy adapter — thin layer over `services/etsyApi.ts`.
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  collectDraftImages,
  draftDescription,
  draftPrice,
  draftSku,
  dryRunResult,
} from "./adapterUtils";
import {
  getEtsyShopId,
  getEtsyTaxonomyId,
  isEtsyConfigured as isEtsyServiceConfigured,
  publishEtsyListing,
} from "../etsyApi";
import { isMarketplaceConnectedForPublish } from "../listingService";

export function formatEtsyListing(draft: DraftPublishPayload): FormattedListing {
  const price = draftPrice(draft);
  const images = collectDraftImages(draft);
  return {
    marketplace: "etsy",
    shopId: getEtsyShopId(),
    sku: draftSku(draft),
    quantity: 1,
    title: draft.title,
    description: draftDescription(draft),
    price: price,
    who_made: "someone_else",
    when_made: "2020_2025",
    taxonomy_id: getEtsyTaxonomyId(),
    type: "physical",
    imageCount: images.length,
    images,
    apiBody: {
      quantity: 1,
      title: draft.title,
      description: draftDescription(draft),
      price: price,
      who_made: "someone_else",
      when_made: "2020_2025",
      taxonomy_id: getEtsyTaxonomyId(),
      type: "physical",
    },
  };
}

export function isEtsyConfigured(): boolean {
  return isEtsyServiceConfigured();
}

export async function publishToEtsy(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isEtsyConfigured()) {
    return dryRunResult(
      "etsy",
      "Etsy OAuth credentials missing — dry run only",
      formatted
    );
  }

  const connected = await isMarketplaceConnectedForPublish("etsy", null);
  if (!connected) {
    return dryRunResult(
      "etsy",
      "Connect Etsy in Settings before publishing (OAuth token missing or expired).",
      formatted
    );
  }

  const apiBody = formatted.apiBody as Record<string, unknown> | undefined;
  if (!apiBody) {
    throw new Error("Etsy formatted listing missing apiBody");
  }

  const images = Array.isArray(formatted.images)
    ? (formatted.images as string[])
    : [];

  try {
    const result = await publishEtsyListing(
      apiBody as Parameters<typeof publishEtsyListing>[0],
      { images, userId: null },
      fetchImpl
    );
    return {
      listingId: result.listingId,
      listingUrl: result.listingUrl,
      message: result.message,
      dryRun: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}
