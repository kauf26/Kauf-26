/**
 * eBay API service layer — credential checks + OAuth connection verify.
 *
 * Phase 1: publish logic stays in `adapters/ebayAdapter.ts`; this file owns
 * the standardized `isEbayConfigured()` / `verifyEbayConnection()` pattern.
 * @see https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
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
