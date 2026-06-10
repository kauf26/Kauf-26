/**
 * Etsy adapter — thin layer over `services/etsyApi.ts`.
 * Owns listing formatting only; credential checks, OAuth, and HTTP live in the service.
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
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

export function formatEtsyListing(draft: DraftPublishPayload): FormattedListing {
  const price = draftPrice(draft);
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
    imageCount: draft.images?.length ?? 0,
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

  const apiBody = formatted.apiBody as Record<string, unknown> | undefined;
  if (!apiBody) {
    throw new Error("Etsy formatted listing missing apiBody");
  }

  try {
    const result = await publishEtsyListing(
      apiBody as Parameters<typeof publishEtsyListing>[0],
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
    if (message.includes("Connect Etsy")) {
      return dryRunResult("etsy", message, formatted);
    }
    throw error;
  }
}
