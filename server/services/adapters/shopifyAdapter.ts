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
import { isShopifyConfigured as isShopifyServiceConfigured, createShopifyProduct } from "../shopifyApi";

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
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isShopifyConfigured()) {
    return dryRunResult(
      "shopify",
      "Shopify OAuth credentials missing — dry run only",
      formatted
    );
  }

  const apiBody = formatted.apiBody as { product?: Record<string, unknown> } | undefined;
  if (!apiBody?.product) {
    throw new Error("Shopify formatted listing missing apiBody.product");
  }

  try {
    const result = await createShopifyProduct(
      apiBody as Parameters<typeof createShopifyProduct>[0],
      fetchImpl
    );
    return {
      listingId: String(result.id),
      listingUrl: result.listingUrl,
      account: formatted.shopDomain ? String(formatted.shopDomain) : undefined,
      message: "Shopify draft product created",
      dryRun: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Connect Shopify")) {
      return dryRunResult("shopify", message, formatted);
    }
    throw error;
  }
}
