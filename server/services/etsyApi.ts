/**
 * Etsy Open API v3 service layer — shared x-api-key header, credential checks,
 * and connection verify (ping + OAuth refresh).
 * @see https://developers.etsy.com/documentation/essentials/requests
 */
import { env, hasEnv } from "./adapters/adapterUtils";

const ETSY_API_BASE = "https://api.etsy.com/v3";
const ETSY_OAUTH_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export function getEtsyKeystring(): string {
  return env("ETSY_API_KEY");
}

export function getEtsySharedSecret(): string {
  return env("ETSY_SHARED_SECRET");
}

export function getEtsyShopId(): string {
  return env("ETSY_SHOP_ID");
}

export function getEtsyTaxonomyId(): number {
  return Number(env("ETSY_TAXONOMY_ID") || 1);
}

/** True when both keystring and shared secret are set (ping-level access). */
export function isEtsyApiKeyConfigured(): boolean {
  return Boolean(getEtsyKeystring() && getEtsySharedSecret());
}

/** Publish-ready credentials (matches `marketplaces.ts` envKeys for etsy). */
export function isEtsyConfigured(): boolean {
  return hasEnv(
    "ETSY_API_KEY",
    "ETSY_SHARED_SECRET",
    "ETSY_CLIENT_ID",
    "ETSY_REFRESH_TOKEN",
    "ETSY_SHOP_ID"
  );
}

/**
 * Etsy requires `x-api-key: keystring:shared_secret` (colon-separated).
 */
export function buildEtsyXApiKeyHeader(): string {
  const keystring = getEtsyKeystring();
  const sharedSecret = getEtsySharedSecret();
  if (!keystring || !sharedSecret) {
    throw new Error(
      "ETSY_API_KEY and ETSY_SHARED_SECRET must both be set in the environment"
    );
  }
  return `${keystring}:${sharedSecret}`;
}

export function buildEtsyApiHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return {
    "x-api-key": buildEtsyXApiKeyHeader(),
    ...extra,
  };
}

export type EtsyConnectionResult = {
  ok: boolean;
  status: number;
  applicationId?: number;
  message: string;
  raw?: unknown;
};

function parseBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/** Step A: ping Etsy Open API (no OAuth scopes required). */
async function pingEtsyApi(
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; status: number; detail: unknown }> {
  const res = await fetchImpl(`${ETSY_API_BASE}/application/openapi-ping`, {
    method: "GET",
    headers: buildEtsyApiHeaders(),
  });
  const detail = parseBody(await res.text());
  return { ok: res.ok, status: res.status, detail };
}

/** Low-level refresh-token exchange; shared by verify and publish paths. */
async function requestEtsyAccessToken(
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; status: number; detail: unknown; accessToken?: string }> {
  const res = await fetchImpl(ETSY_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("ETSY_CLIENT_ID"),
      refresh_token: env("ETSY_REFRESH_TOKEN"),
    }),
  });
  const detail = parseBody(await res.text());
  const accessToken =
    typeof detail === "object" &&
    detail !== null &&
    typeof (detail as { access_token?: unknown }).access_token === "string"
      ? (detail as { access_token: string }).access_token
      : undefined;
  return { ok: res.ok, status: res.status, detail, accessToken };
}

/** Exchange the refresh token for an access token; throws on failure. */
export async function refreshEtsyAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const result = await requestEtsyAccessToken(fetchImpl);
  if (!result.ok || !result.accessToken) {
    throw new Error(
      `Etsy OAuth failed (${result.status}): ${JSON.stringify(result.detail).slice(0, 200)}`
    );
  }
  return result.accessToken;
}

export type EtsyListingResult = {
  listingId?: string;
  raw?: unknown;
};

/**
 * Create a draft listing via `POST /application/shops/{shopId}/listings`.
 * `listing` is the request body (title, description, price, taxonomy_id, ...).
 */
export async function createEtsyListing(
  listing: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<EtsyListingResult> {
  const shopId = getEtsyShopId();
  if (!shopId) {
    throw new Error("ETSY_SHOP_ID must be set in the environment");
  }

  const token = await refreshEtsyAccessToken(fetchImpl);
  const res = await fetchImpl(
    `${ETSY_API_BASE}/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: buildEtsyApiHeaders({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(listing),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Etsy listing create failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  const json = parseBody(text) as { listing_id?: number } | null;
  return {
    listingId:
      json?.listing_id != null ? String(json.listing_id) : undefined,
    raw: json,
  };
}

/**
 * Standardized two-step verify:
 *   A. x-api-key ping (requires ETSY_API_KEY + ETSY_SHARED_SECRET)
 *   B. OAuth refresh-token exchange (only when fully configured)
 */
export async function verifyEtsyConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  const configured = isEtsyConfigured();

  if (!isEtsyApiKeyConfigured()) {
    return {
      ok: false,
      configured,
      status: 0,
      message:
        "Missing ETSY_API_KEY or ETSY_SHARED_SECRET — add both to .env and restart the server",
    };
  }

  const ping = await pingEtsyApi(fetchImpl);
  if (!ping.ok) {
    return {
      ok: false,
      configured,
      status: ping.status,
      message: `Etsy API rejected the x-api-key ping (${ping.status})`,
      detail: ping.detail,
    };
  }

  if (!configured) {
    return {
      ok: true,
      configured: false,
      status: ping.status,
      message:
        "Etsy x-api-key ping succeeded; set ETSY_CLIENT_ID, ETSY_REFRESH_TOKEN, and ETSY_SHOP_ID for publish access",
      detail: ping.detail,
    };
  }

  const oauth = await requestEtsyAccessToken(fetchImpl);
  if (!oauth.ok) {
    return {
      ok: false,
      configured: true,
      status: oauth.status,
      message: `Etsy OAuth refresh-token exchange failed (${oauth.status})`,
      detail: oauth.detail,
    };
  }

  return {
    ok: true,
    configured: true,
    status: oauth.status,
    message: "Etsy API + OAuth verified",
  };
}

/**
 * Legacy alias — same shape as the original ping-only verify, now backed by
 * the standardized two-step check. Used by `GET /api/etsy/verify`.
 */
export async function verifyEtsyApiConnection(
  fetchImpl: typeof fetch = fetch
): Promise<EtsyConnectionResult> {
  const result = await verifyEtsyConnection(fetchImpl);

  const appId =
    typeof result.detail === "object" &&
    result.detail !== null &&
    "application_id" in result.detail &&
    typeof (result.detail as { application_id: unknown }).application_id ===
      "number"
      ? (result.detail as { application_id: number }).application_id
      : undefined;

  return {
    ok: result.ok,
    status: result.status,
    applicationId: appId,
    message: result.message,
    raw: result.detail,
  };
}
