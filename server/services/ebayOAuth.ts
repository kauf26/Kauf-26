/**
 * eBay OAuth 2.0 (authorization code grant + refresh token).
 * @see https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
 */
import { randomBytes } from "node:crypto";
import { env } from "./adapters/adapterUtils";
import { isEbaySandbox, resolveEbayBaseUrl } from "./ebayApi";
import type { StoredOAuthTokens } from "./tokenStorage";

const EBAY_OAUTH_SCOPE =
  "https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account";

export function getEbayClientId(): string {
  return env("EBAY_CLIENT_ID") || env("EBAY_APP_ID");
}

export function getEbayClientSecret(): string {
  return env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID");
}

export function resolveEbayAuthBaseUrl(): string {
  return isEbaySandbox()
    ? "https://auth.sandbox.ebay.com"
    : "https://auth.ebay.com";
}

export function resolveEbayRedirectUri(): string {
  const explicit = env("EBAY_REDIRECT_URI");
  if (explicit) return explicit;
  const base = (env("APP_BASE_URL") || "http://localhost:2626").replace(/\/$/, "");
  return `${base}/api/ebay/oauth/callback`;
}

export function getEbayOAuthScopes(): string {
  return env("EBAY_OAUTH_SCOPES") || EBAY_OAUTH_SCOPE;
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildEbayAuthorizeUrl(state: string): string {
  const query = new URLSearchParams({
    client_id: getEbayClientId(),
    response_type: "code",
    redirect_uri: resolveEbayRedirectUri(),
    scope: getEbayOAuthScopes(),
    state,
  });
  return `${resolveEbayAuthBaseUrl()}/oauth2/authorize?${query.toString()}`;
}

type EbayTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

function basicAuth(): string {
  return Buffer.from(`${getEbayClientId()}:${getEbayClientSecret()}`).toString(
    "base64"
  );
}

async function postEbayToken(
  body: URLSearchParams,
  context: string,
  fetchImpl: typeof fetch = fetch
): Promise<Partial<StoredOAuthTokens>> {
  const res = await fetchImpl(`${resolveEbayBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  let json: EbayTokenResponse = {};
  try {
    json = text ? (JSON.parse(text) as EbayTokenResponse) : {};
  } catch {
    throw new Error(`eBay ${context} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `eBay ${context} failed (${res.status}): ${
        json.error_description ?? json.error ?? text.slice(0, 200)
      }`
    );
  }
  if (!json.access_token) {
    throw new Error(`eBay ${context} failed: no access_token in response`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
    refreshExpiresAt: json.refresh_token_expires_in
      ? Date.now() + json.refresh_token_expires_in * 1000
      : undefined,
  };
}

export async function exchangeEbayCode(
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<StoredOAuthTokens> {
  const tokens = await postEbayToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: resolveEbayRedirectUri(),
    }),
    "code exchange",
    fetchImpl
  );
  return tokens as StoredOAuthTokens;
}

export async function refreshEbayOAuthTokens(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<Partial<StoredOAuthTokens>> {
  return postEbayToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: getEbayOAuthScopes(),
    }),
    "token refresh",
    fetchImpl
  );
}

export async function getEbayAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string }> {
  const { getValidAccessToken } = await import("./marketplaceTokenService");
  const tok = await getValidAccessToken("ebay", undefined, fetchImpl);
  return { accessToken: tok.accessToken };
}
