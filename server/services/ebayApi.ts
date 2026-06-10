/**
 * eBay helpers — server OAuth tokens in marketplace_auth when connected.
 */
import { env } from "./adapters/adapterUtils";
import {
  getAccessTokenForListingPublish,
  isMarketplaceConnectedForPublish,
} from "./listingService";

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

export function getEbayMarketplaceId(): string {
  return env("EBAY_MARKETPLACE_ID") || "EBAY_US";
}

export function getEbayCategoryId(): string {
  return env("EBAY_CATEGORY_ID") || "93427";
}

export function isEbayConfigured(): boolean {
  return (
    Boolean(env("EBAY_CLIENT_ID") || env("EBAY_APP_ID")) &&
    Boolean(env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID"))
  );
}

async function refreshEbayAccessTokenFromEnv(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const clientId = env("EBAY_CLIENT_ID") || env("EBAY_APP_ID");
  const clientSecret = env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID");
  const refreshToken = env("EBAY_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("EBAY_REFRESH_TOKEN not configured");
  }

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

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function resolveEbayAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const fromOAuth = await getAccessTokenForListingPublish("ebay", null);
  if (fromOAuth) return fromOAuth;

  if (env("EBAY_REFRESH_TOKEN")) {
    return refreshEbayAccessTokenFromEnv(fetchImpl);
  }

  throw new Error(
    "Connect eBay in Settings before publishing (OAuth token missing or expired)."
  );
}

export async function verifyEbayConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  const hasApp = isEbayConfigured();
  if (!hasApp) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set.",
    };
  }

  try {
    await resolveEbayAccessToken(fetchImpl);
    return {
      ok: true,
      configured: true,
      status: 200,
      message: "eBay connected via server OAuth.",
    };
  } catch (error) {
    const connected = await isMarketplaceConnectedForPublish("ebay", null);
    if (connected) {
      return {
        ok: false,
        configured: true,
        status: 401,
        message: error instanceof Error ? error.message : "eBay token invalid.",
      };
    }
    return {
      ok: false,
      configured: true,
      status: 401,
      message: "Connect eBay in Settings to authorize publishing.",
    };
  }
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
  listingUrl?: string;
  message: string;
};

export async function publishEbayInventoryListing(
  listing: EbayInventoryListing,
  fetchImpl: typeof fetch = fetch
): Promise<EbayPublishResult> {
  const token = await resolveEbayAccessToken(fetchImpl);
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
  const listingId = published.listingId ?? offerId;
  return {
    listingId,
    offerId,
    listingUrl: published.listingId
      ? `https://www.ebay.com/itm/${published.listingId}`
      : undefined,
    message: "eBay listing published",
  };
}
