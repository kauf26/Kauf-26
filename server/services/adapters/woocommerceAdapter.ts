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

export function formatWooCommerceListing(
  draft: DraftPublishPayload
): FormattedListing {
  const price = draftPrice(draft).toFixed(2);
  return {
    marketplace: "woocommerce",
    siteUrl: env("WOOCOMMERCE_SITE_URL"),
    sku: draftSku(draft),
    imageCount: draft.images?.length ?? 0,
    apiBody: {
      name: draft.title,
      type: "simple",
      status: "draft",
      description: draftDescription(draft),
      sku: draftSku(draft),
      regular_price: price,
      manage_stock: true,
      stock_quantity: 1,
    },
  };
}

export function isWooCommerceConfigured(): boolean {
  return hasEnv(
    "WOOCOMMERCE_SITE_URL",
    "WOOCOMMERCE_CONSUMER_KEY",
    "WOOCOMMERCE_CONSUMER_SECRET"
  );
}

function wooAuthHeader(): string {
  const key = env("WOOCOMMERCE_CONSUMER_KEY");
  const secret = env("WOOCOMMERCE_CONSUMER_SECRET");
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

export async function publishToWooCommerce(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isWooCommerceConfigured()) {
    return dryRunResult(
      "woocommerce",
      "WooCommerce REST credentials missing — dry run only",
      formatted
    );
  }

  const base = env("WOOCOMMERCE_SITE_URL").replace(/\/$/, "");
  const url = `${base}/wp-json/wc/v3/products`;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: wooAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formatted.apiBody),
  });

  if (!res.ok) {
    throw new Error(
      `WooCommerce API failed (${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }

  const json = (await res.json()) as { id?: number };
  return {
    message: "WooCommerce draft product created",
    listingId: json.id != null ? String(json.id) : undefined,
    dryRun: false,
  };
}
