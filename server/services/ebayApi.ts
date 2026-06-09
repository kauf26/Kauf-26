/**
 * eBay API service layer — credential checks, OAuth, and Sell Inventory API.
 * Sandbox vs production base URL is driven by EBAY_SANDBOX.
 * @see https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
 * @see https://developer.ebay.com/api-docs/sell/inventory/overview.html
 */
import { env, hasEnv } from "./adapters/adapterUtils";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

const EBAY_OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.inventory";

export function isEbaySandbox(): boolean {
  return env("EBAY_SANDBOX") === "true";
}

export function resolveEbayBaseUrl(): string {
  return isEbaySandbox()
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

/** Publish-ready credentials (matches `marketplaces.ts` envKeys for ebay). */
export function isEbayConfigured(): boolean {
  return hasEnv("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN");
}

export function getEbayMarketplaceId(): string {
  return env("EBAY_MARKETPLACE_ID") || "EBAY_US";
}

export function getEbayCategoryId(): string {
  return env("EBAY_CATEGORY_ID") || "93427";
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Exchange the refresh token for an access token (cached until near expiry).
 * Independent copy from ebayAdapter; adapters migrate here in Phase 2.
 */
export async function refreshEbayAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = env("EBAY_CLIENT_ID");
  const clientSecret = env("EBAY_CLIENT_SECRET");
  const refreshToken = env("EBAY_REFRESH_TOKEN");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetchImpl(`${resolveEbayBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_OAUTH_SCOPE,
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

/**
 * Verify eBay credentials by performing an OAuth refresh-token exchange.
 * Does not create or modify any listings.
 */
export async function verifyEbayConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  if (!isEbayConfigured()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "Missing EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, or EBAY_REFRESH_TOKEN — add them to .env and restart the server",
    };
  }

  const clientId = env("EBAY_CLIENT_ID");
  const clientSecret = env("EBAY_CLIENT_SECRET");
  const refreshToken = env("EBAY_REFRESH_TOKEN");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetchImpl(`${resolveEbayBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_OAUTH_SCOPE,
    }),
  });

  const text = await res.text();
  let detail: unknown;
  try {
    detail = text ? JSON.parse(text) : null;
  } catch {
    detail = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    return {
      ok: false,
      configured: true,
      status: res.status,
      message: `eBay OAuth token refresh failed (${res.status})${
        isEbaySandbox() ? " [sandbox]" : ""
      }`,
      detail,
    };
  }

  return {
    ok: true,
    configured: true,
    status: res.status,
    message: `eBay OAuth token refresh successful${
      isEbaySandbox() ? " [sandbox]" : ""
    }`,
  };
}

export type EbayInventoryListing = {
  sku: string;
  title: string;
  description: string;
  brand?: string;
  condition: string;
  price: { value: string; currency: string };
  quantity?: number;
  marketplaceId: string;
  categoryId: string;
  listingFormat: string;
};

export type EbayPublishResult = {
  listingId: string;
  offerId?: string;
  message: string;
};

/**
 * Sell Inventory API flow:
 *   1. PUT  /sell/inventory/v1/inventory_item/{sku}
 *   2. POST /sell/inventory/v1/offer
 *   3. POST /sell/inventory/v1/offer/{offerId}/publish
 * Listing policies (fulfillment/payment/return) are read from env when set.
 */
export async function publishEbayInventoryListing(
  listing: EbayInventoryListing,
  fetchImpl: typeof fetch = fetch
): Promise<EbayPublishResult> {
  const token = await refreshEbayAccessToken(fetchImpl);
  const baseUrl = resolveEbayBaseUrl();
  const sku = listing.sku;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Language": "en-US",
  };

  const inventoryBody = {
    product: {
      title: listing.title,
      description: listing.description,
      aspects: listing.brand ? { Brand: [String(listing.brand)] } : undefined,
    },
    condition: listing.condition,
    availability: {
      shipToLocationAvailability: { quantity: listing.quantity ?? 1 },
    },
  };

  const invRes = await fetchImpl(
    `${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    { method: "PUT", headers, body: JSON.stringify(inventoryBody) }
  );
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(
      `eBay createInventoryItem failed (${invRes.status}): ${text.slice(0, 300)}`
    );
  }

  const offerBody = {
    sku,
    marketplaceId: listing.marketplaceId,
    format: listing.listingFormat,
    listingDescription: listing.description,
    availableQuantity: listing.quantity ?? 1,
    categoryId: listing.categoryId,
    pricingSummary: {
      price: { value: listing.price.value, currency: listing.price.currency },
    },
    listingPolicies: {
      fulfillmentPolicyId: env("EBAY_FULFILLMENT_POLICY_ID") || undefined,
      paymentPolicyId: env("EBAY_PAYMENT_POLICY_ID") || undefined,
      returnPolicyId: env("EBAY_RETURN_POLICY_ID") || undefined,
    },
  };

  const offerRes = await fetchImpl(`${baseUrl}/sell/inventory/v1/offer`, {
    method: "POST",
    headers,
    body: JSON.stringify(offerBody),
  });
  if (!offerRes.ok) {
    const text = await offerRes.text();
    throw new Error(
      `eBay createOffer failed (${offerRes.status}): ${text.slice(0, 300)}`
    );
  }

  const offer = (await offerRes.json()) as { offerId?: string };
  const offerId = offer.offerId;
  if (!offerId) {
    return {
      listingId: sku,
      message: "eBay offer created (no offerId in response)",
    };
  }

  const pubRes = await fetchImpl(
    `${baseUrl}/sell/inventory/v1/offer/${offerId}/publish`,
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
    offerId,
    message: "eBay listing published",
  };
}
