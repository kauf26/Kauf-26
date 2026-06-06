import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function ebayBaseUrl(): string {
  return env("EBAY_SANDBOX") === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

export function formatEbayListing(draft: DraftPublishPayload): FormattedListing {
  const a = draft.attributes ?? {};
  const market = (a.marketPrices as Record<string, string>) ?? {};
  const price =
    parseFloat(market.recommendedPrice ?? String(a.medianPrice ?? "0")) || 0;
  const sku = draft.sku?.trim() || `kauf26-${draft.draftId}`;

  return {
    sku,
    title: draft.title,
    description: String(a.longDescription ?? a.aiDescription ?? draft.title),
    brand: a.brand ?? "",
    condition: mapEbayCondition(String(a.condition ?? "Used")),
    price: { value: price.toFixed(2), currency: "USD" },
    quantity: 1,
    marketplaceId: env("EBAY_MARKETPLACE_ID") || "EBAY_US",
    categoryId: env("EBAY_CATEGORY_ID") || "93427",
    imageCount: draft.images?.length ?? 0,
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
  return Boolean(
    env("EBAY_CLIENT_ID") &&
      env("EBAY_CLIENT_SECRET") &&
      env("EBAY_REFRESH_TOKEN")
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function refreshEbayAccessToken(
  fetchImpl: FetchFn = fetch
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = env("EBAY_CLIENT_ID");
  const clientSecret = env("EBAY_CLIENT_SECRET");
  const refreshToken = env("EBAY_REFRESH_TOKEN");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetchImpl(`${ebayBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function publishToEbay(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isEbayConfigured()) {
    console.log("[Publish][eBay] dry-run payload:", JSON.stringify(formatted));
    return {
      message: "eBay OAuth credentials missing — dry run only",
      dryRun: true,
      listingId: `ebay-dry-${Date.now()}`,
    };
  }

  const token = await refreshEbayAccessToken(fetchImpl);
  const sku = String(formatted.sku);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Language": "en-US",
  };

  const inventoryBody = {
    product: {
      title: formatted.title,
      description: formatted.description,
      aspects: formatted.brand
        ? { Brand: [String(formatted.brand)] }
        : undefined,
    },
    condition: formatted.condition,
    availability: {
      shipToLocationAvailability: { quantity: formatted.quantity ?? 1 },
    },
  };

  const invRes = await fetchImpl(
    `${ebayBaseUrl()}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    { method: "PUT", headers, body: JSON.stringify(inventoryBody) }
  );
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(
      `eBay createInventoryItem failed (${invRes.status}): ${text.slice(0, 300)}`
    );
  }

  const price = formatted.price as { value: string; currency: string };
  const offerBody = {
    sku,
    marketplaceId: formatted.marketplaceId,
    format: formatted.listingFormat,
    listingDescription: formatted.description,
    availableQuantity: formatted.quantity ?? 1,
    categoryId: formatted.categoryId,
    pricingSummary: {
      price: { value: price.value, currency: price.currency },
    },
    listingPolicies: {
      fulfillmentPolicyId: env("EBAY_FULFILLMENT_POLICY_ID") || undefined,
      paymentPolicyId: env("EBAY_PAYMENT_POLICY_ID") || undefined,
      returnPolicyId: env("EBAY_RETURN_POLICY_ID") || undefined,
    },
  };

  const offerRes = await fetchImpl(
    `${ebayBaseUrl()}/sell/inventory/v1/offer`,
    { method: "POST", headers, body: JSON.stringify(offerBody) }
  );
  if (!offerRes.ok) {
    const text = await offerRes.text();
    throw new Error(
      `eBay createOffer failed (${offerRes.status}): ${text.slice(0, 300)}`
    );
  }

  const offer = (await offerRes.json()) as { offerId?: string };
  const offerId = offer.offerId;
  if (!offerId) {
    return { message: "eBay offer created (no offerId in response)", listingId: sku };
  }

  const pubRes = await fetchImpl(
    `${ebayBaseUrl()}/sell/inventory/v1/offer/${offerId}/publish`,
    { method: "POST", headers }
  );
  if (!pubRes.ok) {
    const text = await pubRes.text();
    throw new Error(
      `eBay publishOffer failed (${pubRes.status}): ${text.slice(0, 300)}`
    );
  }

  const published = (await pubRes.json()) as { listingId?: string };
  return {
    listingId: published.listingId ?? offerId,
    message: "eBay listing published",
    dryRun: false,
  };
}
