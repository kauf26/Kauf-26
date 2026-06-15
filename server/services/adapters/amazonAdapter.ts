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
import { getAccessTokenForListingPublish } from "../listingService";

export function formatAmazonListing(draft: DraftPublishPayload): FormattedListing {
  const a = draft.attributes ?? {};
  const price = draftPrice(draft);
  const sku = draftSku(draft);

  return {
    marketplace: "amazon",
    sku,
    sellerId: env("AMAZON_SELLER_ID"),
    marketplaceIds: [env("AMAZON_MARKETPLACE_ID") || "ATVPDKIKX0DER"],
    productType: "PRODUCT",
    attributes: {
      item_name: [{ value: draft.title, marketplace_id: "ATVPDKIKX0DER" }],
      condition_type: [
        {
          value: String(a.condition ?? "used_like_new")
            .toLowerCase()
            .includes("new")
            ? "new_new"
            : "used_like_new",
        },
      ],
      list_price: [
        {
          value: price,
          currency: "USD",
        },
      ],
      product_description: [{ value: draftDescription(draft) }],
      brand: a.brand ? [{ value: String(a.brand) }] : undefined,
    },
    imageCount: draft.images?.length ?? 0,
    apiBody: {
      productType: "PRODUCT",
      requirements: "LISTING",
      attributes: {
        item_name: [{ value: draft.title }],
        condition_type: [{ value: "used_like_new" }],
        list_price: [{ value: price, currency: "USD" }],
        product_description: [{ value: draftDescription(draft) }],
      },
    },
  };
}

export function isAmazonConfigured(): boolean {
  return hasEnv("AMAZON_CLIENT_ID", "AMAZON_CLIENT_SECRET", "AMAZON_SELLER_ID");
}

export async function publishToAmazon(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch,
  userId: number | null = null
): Promise<AdapterPublishResult> {
  if (!isAmazonConfigured()) {
    return dryRunResult(
      "amazon",
      "Amazon SP-API credentials missing — dry run only",
      formatted
    );
  }

  const token = await getAccessTokenForListingPublish("amazon", userId);
  if (!token) {
    throw new Error("Amazon account not connected. Please connect in Connections.");
  }

  const sellerId = env("AMAZON_SELLER_ID");
  const sku = String(formatted.sku);
  const host =
    env("AMAZON_SANDBOX") === "true"
      ? "sandbox.sellingpartnerapi-na.amazon.com"
      : "sellingpartnerapi-na.amazon.com";

  const url = `https://${host}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`;

  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-amz-access-token": token,
    },
    body: JSON.stringify(formatted.apiBody ?? formatted),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amazon Listings API failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { sku?: string; submissionId?: string };
  return {
    message: "Amazon listing submitted via SP-API Listings 2021-08-01",
    listingId: json.submissionId ?? json.sku ?? sku,
    dryRun: false,
  };
}
