/**
 * eBay helpers — OAuth tokens come from the client per request (never stored server-side).
 */
import { env } from "./adapters/adapterUtils";
import {
  getAccessTokenForListingPublish,
  isMarketplaceConnectedForPublish,
} from "./listingService";
import { isMockOAuthMode } from "./oauth/mockOAuth";
import { getClientMarketplaceToken } from "./publishTokenContext";
import { refreshToken } from "./oauthService";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export const EBAY_TOKEN_EXPIRED = "EBAY_TOKEN_EXPIRED";

export class EbayAuthError extends Error {
  readonly code = EBAY_TOKEN_EXPIRED;

  constructor(
    message = `${EBAY_TOKEN_EXPIRED}: Invalid access token — reconnect eBay in Connections`
  ) {
    super(message);
    this.name = "EbayAuthError";
  }
}

const EBAY_OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.inventory";

let warnedMissingEbayRefreshToken = false;

function warnMissingEbayRefreshToken(): void {
  if (warnedMissingEbayRefreshToken) return;
  if (!env("EBAY_REFRESH_TOKEN")) {
    console.warn(
      "[eBay] EBAY_REFRESH_TOKEN not set — publish requires device OAuth tokens per request"
    );
  }
  warnedMissingEbayRefreshToken = true;
}

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
  if (isMockOAuthMode()) return true;
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
  const refreshTokenValue = env("EBAY_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshTokenValue) {
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
      refresh_token: refreshTokenValue,
      scope: EBAY_OAUTH_SCOPE,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new EbayAuthError(
        `${EBAY_TOKEN_EXPIRED}: Invalid access token — eBay refresh rejected (401): ${text.slice(0, 120)}`
      );
    }
    throw new Error(`eBay OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function refreshEbayFromClientCredential(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const client = getClientMarketplaceToken("ebay");
  if (!client?.refreshToken) {
    throw new EbayAuthError("Invalid access token — no eBay refresh token in request");
  }

  try {
    const refreshed = await refreshToken("ebay", client.refreshToken, {
      userId: null,
      shopDomain: client.shopDomain,
    });
    return refreshed.accessToken;
  } catch (error) {
    throw new EbayAuthError(
      error instanceof Error
        ? error.message.includes(EBAY_TOKEN_EXPIRED)
          ? error.message
          : `${EBAY_TOKEN_EXPIRED}: Invalid access token — reconnect eBay`
        : `${EBAY_TOKEN_EXPIRED}: Invalid access token — reconnect eBay`
    );
  }
}

async function resolveEbayAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  warnMissingEbayRefreshToken();

  if (isMockOAuthMode()) {
    const mock = await getAccessTokenForListingPublish("ebay", null);
    return mock ?? `mock_ebay_access_${Date.now()}`;
  }

  const fromOAuth = await getAccessTokenForListingPublish("ebay", null);
  if (fromOAuth) return fromOAuth;

  const client = getClientMarketplaceToken("ebay");
  if (client?.refreshToken) {
    return refreshEbayFromClientCredential(fetchImpl);
  }

  if (env("EBAY_REFRESH_TOKEN")) {
    return refreshEbayAccessTokenFromEnv(fetchImpl);
  }

  throw new EbayAuthError(
    "Connect eBay in Settings before publishing (OAuth token missing or expired)."
  );
}

async function callEbayApi(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  let token = await resolveEbayAccessToken(fetchImpl);
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };

  let response = await fetchImpl(url, { ...init, headers });
  if (response.status !== 401) {
    return response;
  }

  console.warn("[eBay] API returned 401 — refreshing token and retrying once");
  try {
    token = await refreshEbayFromClientCredential(fetchImpl);
    if (!token && env("EBAY_REFRESH_TOKEN")) {
      token = await refreshEbayAccessTokenFromEnv(fetchImpl);
    }
  } catch (error) {
    if (error instanceof EbayAuthError) throw error;
    throw new EbayAuthError();
  }

  response = await fetchImpl(url, {
    ...init,
    headers: { ...headers, Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new EbayAuthError();
  }

  return response;
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

  if (isMockOAuthMode()) {
    return {
      ok: true,
      configured: true,
      status: 200,
      message: "eBay connected via mock OAuth (MOCK_OAUTH_MODE).",
    };
  }

  try {
    await resolveEbayAccessToken(fetchImpl);
    return {
      ok: true,
      configured: true,
      status: 200,
      message: "eBay token available for this request.",
    };
  } catch (error) {
    if (error instanceof EbayAuthError) {
      return {
        ok: false,
        configured: true,
        status: 401,
        message: error.message,
      };
    }
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
  if (isMockOAuthMode()) {
    const listingId = `mock-ebay-${Date.now()}`;
    return {
      listingId,
      message: "eBay mock publish succeeded (MOCK_OAUTH_MODE)",
      listingUrl: `https://www.ebay.com/itm/${listingId}`,
    };
  }

  const baseUrl = resolveEbayBaseUrl();
  const sku = listing.sku;
  const jsonHeaders = {
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

  const invRes = await callEbayApi(
    `${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    { method: "PUT", headers: jsonHeaders, body: JSON.stringify(inventoryBody) },
    fetchImpl
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

  const offerRes = await callEbayApi(
    `${baseUrl}/sell/inventory/v1/offer`,
    { method: "POST", headers: jsonHeaders, body: JSON.stringify(offerBody) },
    fetchImpl
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
    return {
      listingId: sku,
      message: "eBay offer created (no offerId in response)",
    };
  }

  const pubRes = await callEbayApi(
    `${baseUrl}/sell/inventory/v1/offer/${offerId}/publish`,
    { method: "POST", headers: jsonHeaders },
    fetchImpl
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
