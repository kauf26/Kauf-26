/**
 * Etsy Open API v3 service layer — OAuth-backed.
 *
 * Credentials model:
 * - ETSY_CLIENT_ID (app keystring) is the only env credential; it is sent as
 *   the x-api-key header on every request and doubles as the OAuth client_id.
 * - User tokens (access + refresh) live in backend token storage, written by
 *   the /api/etsy/oauth/* flow. No API keys or refresh tokens are read from
 *   user input; ETSY_SHARED_SECRET is no longer used anywhere.
 * @see https://developers.etsy.com/documentation/essentials/requests
 */
import { env } from "./adapters/adapterUtils";
import {
  fetchEtsyIdentity,
  getEtsyAccessToken,
  getEtsyClientId,
} from "./etsyOAuth";
import { hasStoredTokens } from "./tokenStorage";

const ETSY_API_BASE = "https://api.etsy.com/v3";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export { getEtsyClientId };

/** Env fallback for display; the publish path prefers the OAuth shop_id. */
export function getEtsyShopId(): string {
  return env("ETSY_SHOP_ID");
}

export function getEtsyTaxonomyId(): number {
  return Number(env("ETSY_TAXONOMY_ID") || 1);
}

/**
 * Publish-ready: app keystring present AND merchant has completed the
 * OAuth connect flow (tokens in backend storage).
 */
export function isEtsyConfigured(): boolean {
  return Boolean(getEtsyClientId()) && hasStoredTokens("etsy");
}

function baseHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-api-key": getEtsyClientId(),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

/**
 * Verify the stored OAuth connection:
 * 1. Load tokens from backend storage (refreshing if expired)
 * 2. GET /v3/application/users/me to confirm the credential works
 * Returns shop name/ID so the dashboard can show which account is connected.
 */
export async function verifyEtsyConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  if (!getEtsyClientId()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "Missing ETSY_CLIENT_ID (your Etsy app keystring) — add it to .env and restart the server",
    };
  }

  if (!hasStoredTokens("etsy")) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "Etsy is not connected yet — open /api/etsy/oauth/start to authorize the app with your Etsy account",
    };
  }

  try {
    const { accessToken } = await getEtsyAccessToken(fetchImpl);
    const identity = await fetchEtsyIdentity(accessToken, fetchImpl);
    return {
      ok: true,
      configured: true,
      status: 200,
      message: identity.shopName
        ? `Connected to Etsy shop "${identity.shopName}"`
        : `Connected to Etsy (user ${identity.userId})`,
      detail: {
        userId: identity.userId,
        shopId: identity.shopId,
        shopName: identity.shopName,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/\((\d{3})\)/);
    return {
      ok: false,
      configured: true,
      status: statusMatch ? Number(statusMatch[1]) : 0,
      message: `Etsy verification failed: ${message}`,
    };
  }
}

export type EtsyListingResult = {
  listingId?: string;
  shopId?: string;
  raw?: unknown;
};

/**
 * Create a draft listing via `POST /application/shops/{shopId}/listings`
 * using the stored OAuth tokens (auto-refreshed). Shop ID comes from the
 * OAuth identity, with ETSY_SHOP_ID as an env override/fallback.
 */
export async function createEtsyListing(
  listing: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<EtsyListingResult> {
  const { accessToken, shopId: oauthShopId } = await getEtsyAccessToken(fetchImpl);
  const shopId = oauthShopId || getEtsyShopId();
  if (!shopId) {
    throw new Error(
      "No Etsy shop ID available — re-connect via /api/etsy/oauth/start or set ETSY_SHOP_ID"
    );
  }

  const res = await fetchImpl(
    `${ETSY_API_BASE}/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listing),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Etsy listing create failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  let json: { listing_id?: number } | null = null;
  try {
    json = text ? (JSON.parse(text) as { listing_id?: number }) : null;
  } catch {
    /* keep raw */
  }

  return {
    listingId: json?.listing_id != null ? String(json.listing_id) : undefined,
    shopId,
    raw: json ?? text.slice(0, 500),
  };
}
