/**
 * eBay API service layer — credential checks, OAuth, and Sell Inventory API.
 * Sandbox vs production base URL is driven by EBAY_SANDBOX.
 * @see https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
 * @see https://developer.ebay.com/api-docs/sell/inventory/overview.html
 */
import { env } from "./adapters/adapterUtils";
import { hasStoredTokens } from "./tokenStorage";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export function isEbaySandbox(): boolean {
  return env("EBAY_SANDBOX") === "true";
}

export function resolveEbayBaseUrl(): string {
  return isEbaySandbox()
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

/** OAuth-connected: app credentials in env + user tokens in backend storage. */
export function isEbayConfigured(): boolean {
  return (
    Boolean(env("EBAY_CLIENT_ID") || env("EBAY_APP_ID")) &&
    Boolean(env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID")) &&
    hasStoredTokens("ebay")
  );
}

export async function refreshEbayAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const { getValidAccessToken } = await import("./marketplaceTokenService");
  const tok = await getValidAccessToken("ebay", undefined, fetchImpl);
  return tok.accessToken;
}

export function getEbayMarketplaceId(): string {
  return env("EBAY_MARKETPLACE_ID") || "EBAY_US";
}

export function getEbayCategoryId(): string {
  return env("EBAY_CATEGORY_ID") || "93427";
}

/**
 * Verify eBay OAuth connection by refreshing the stored token.
 */
export async function verifyEbayConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  const hasAppCreds =
    Boolean(env("EBAY_CLIENT_ID") || env("EBAY_APP_ID")) &&
    Boolean(env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID"));

  if (!hasAppCreds) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "Missing EBAY_CLIENT_ID and EBAY_CLIENT_SECRET — add your eBay app credentials to .env",
    };
  }

  if (!hasStoredTokens("ebay")) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "eBay is not connected yet — open /api/ebay/oauth/start to authorize the app",
    };
  }

  try {
    await refreshEbayAccessToken(fetchImpl);
    return {
      ok: true,
      configured: true,
      status: 200,
      message: `eBay OAuth connected${isEbaySandbox() ? " [sandbox]" : ""}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/\((\d{3})\)/);
    return {
      ok: false,
      configured: true,
      status: statusMatch ? Number(statusMatch[1]) : 0,
      message: `eBay verification failed: ${message}`,
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
