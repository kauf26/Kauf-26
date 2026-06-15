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
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

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
