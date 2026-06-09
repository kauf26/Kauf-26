/**
 * Shopify adapter — listing formatting only; publish runs on mobile.
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  draftDescription,
  draftPrice,
  draftSku,
  dryRunResult,
} from "./adapterUtils";
import { isShopifyConfigured as isShopifyServiceConfigured } from "../shopifyApi";

export function formatShopifyListing(
  draft: DraftPublishPayload
): FormattedListing {
  const price = draftPrice(draft).toFixed(2);
  return {
    marketplace: "shopify",
    shopDomain: "",
    sku: draftSku(draft),
    imageCount: draft.images?.length ?? 0,
    apiBody: {
      product: {
        title: draft.title,
        body_html: draftDescription(draft),
        vendor: String(draft.attributes?.brand ?? "Kauf26"),
        product_type: String(draft.attributes?.category ?? ""),
        status: "draft",
        variants: [
          {
            sku: draftSku(draft),
            price,
            inventory_management: "shopify",
            inventory_quantity: 1,
          },
        ],
      },
    },
  };
}

export function isShopifyConfigured(): boolean {
  return isShopifyServiceConfigured();
}

export async function publishToShopify(
  formatted: FormattedListing,
  _fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  return dryRunResult(
    "shopify",
    "Shopify publish is mobile-only — connect in the app and publish from your device",
    formatted
  );
}
