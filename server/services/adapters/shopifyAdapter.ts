import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  draftDescription,
  draftPrice,
  draftSku,
  dryRunResult,
  env,
  hasEnv,
} from "./adapterUtils";

export function formatShopifyListing(
  draft: DraftPublishPayload
): FormattedListing {
  const price = draftPrice(draft).toFixed(2);
  return {
    marketplace: "shopify",
    shopDomain: env("SHOPIFY_SHOP_DOMAIN"),
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
  return hasEnv("SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ACCESS_TOKEN");
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

  const domain = env("SHOPIFY_SHOP_DOMAIN").replace(/^https?:\/\//, "");
  const url = `https://${domain}/admin/api/2024-01/products.json`;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": env("SHOPIFY_ACCESS_TOKEN"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formatted.apiBody),
  });

  if (!res.ok) {
    throw new Error(
      `Shopify API failed (${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }

  const json = (await res.json()) as { product?: { id?: number } };
  return {
    message: "Shopify draft product created",
    listingId:
      json.product?.id != null ? String(json.product.id) : undefined,
    dryRun: false,
  };
}
