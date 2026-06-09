/**
 * eBay adapter — thin layer over `services/ebayApi.ts`.
 * Owns listing formatting only; OAuth, base-URL resolution (EBAY_SANDBOX),
 * and the Sell Inventory API flow live in the service.
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import { draftImageCount, draftPrice } from "./adapterUtils";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  getEbayCategoryId,
  getEbayMarketplaceId,
  isEbayConfigured as isEbayServiceConfigured,
  isEbaySandbox,
  type EbayInventoryListing,
} from "../ebayApi";

export function formatEbayListing(draft: DraftPublishPayload): FormattedListing {
  const a = draft.attributes ?? {};
  const price = draftPrice(draft);
  const sku = draft.sku?.trim() || `kauf26-${draft.draftId}`;

  return {
    sku,
    title: draft.title,
    description: String(a.longDescription ?? a.aiDescription ?? draft.title),
    brand: a.brand ?? "",
    condition: mapEbayCondition(String(a.condition ?? "Used")),
    price: { value: price.toFixed(2), currency: "USD" },
    quantity: 1,
    marketplaceId: getEbayMarketplaceId(),
    categoryId: getEbayCategoryId(),
    imageCount: draftImageCount(draft),
    images: draft.images ?? [],
    listingFormat: "FIXED_PRICE",
  };
}

function mapEbayCondition(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("new")) return "NEW";
  if (c.includes("like")) return "LIKE_NEW";
  if (c.includes("fair")) return "USED_ACCEPTABLE";
  return "USED_GOOD";
}

export function isEbayConfigured(): boolean {
  return isEbayServiceConfigured();
}

export async function publishToEbay(
  formatted: FormattedListing,
  _fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  return {
    message: "eBay publish is mobile-only — connect in the app and publish from your device",
    dryRun: true,
    listingId: `ebay-mobile-${Date.now()}`,
  };
}
