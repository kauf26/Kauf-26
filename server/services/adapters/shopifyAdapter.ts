/**
 * Shopify adapter — thin layer over `services/shopifyApi.ts`.
 * Owns listing formatting only; credential checks and HTTP live in the service.
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  draftDescription,
  draftPrice,
  draftSku,
  dryRunResult,
  env,
} from "./adapterUtils";
import {
  createShopifyProduct,
  isShopifyConfigured as isShopifyServiceConfigured,
  resolveShopifyConfigFromEnv,
} from "../shopifyApi";

export function formatShopifyListing(
  draft: DraftPublishPayload
): FormattedListing {
  const price = draftPrice(draft).toFixed(2);
  return {
    marketplace: "shopify",
    shopDomain: env("SHOPIFY_SHOP_DOMAIN") || env("SHOPIFY_STORE_NAME"),
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
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isShopifyConfigured()) {
    return dryRunResult(
      "shopify",
      "Shopify Admin API credentials missing — dry run only",
      formatted
    );
  }

  const { product } = formatted.apiBody as {
    product: Record<string, unknown>;
  };

  const created = await createShopifyProduct(
    resolveShopifyConfigFromEnv(),
    product,
    fetchImpl
  );

  return {
    message: "Shopify draft product created",
    listingId: String(created.id),
    dryRun: false,
  };
}
