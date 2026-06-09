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
  createEtsyListing,
  getEtsyShopId,
  getEtsyTaxonomyId,
  isEtsyConfigured as isEtsyServiceConfigured,
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
      "Etsy Open API credentials missing — dry run only",
      formatted
    );
  }

  const listing = (formatted.apiBody ?? formatted) as Record<string, unknown>;
  const created = await createEtsyListing(listing, fetchImpl);

  return {
    message: "Etsy draft listing created",
    listingId: created.listingId,
    listingUrl: created.listingId
      ? `https://www.etsy.com/listing/${created.listingId}`
      : undefined,
    account: getEtsyShopId() ? `Etsy shop ${getEtsyShopId()}` : undefined,
    dryRun: false,
  };
}
