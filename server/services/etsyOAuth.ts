/**
 * Etsy OAuth 2.0 (authorization code + PKCE) service.
 *
 * Etsy v3 specifics:
 * - PKCE (S256) is mandatory; there is no client_secret in the token exchange.
 *   The "client ID" is the app keystring, which is also sent as the x-api-key
 *   header on every API call.
 * - access_token is "{user_id}.{token}" and expires in ~1 hour; refresh_token
 *   is long-lived and rotates on every refresh.
 * @see https://developers.etsy.com/documentation/essentials/authentication
 */
import { createHash, randomBytes } from "node:crypto";
import { env } from "./adapters/adapterUtils";
import type { StoredOAuthTokens } from "./tokenStorage";

const ETSY_CONNECT_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_API_BASE = "https://api.etsy.com/v3";

const DEFAULT_SCOPES = "email_r listings_r listings_w shops_r shops_w";

/** Etsy's OAuth client_id is the app keystring (also the x-api-key header). */
export function getEtsyClientId(): string {
  return env("ETSY_CLIENT_ID");
}

export function getEtsyOAuthScopes(): string {
  return env("ETSY_OAUTH_SCOPES") || DEFAULT_SCOPES;
}

export function resolveEtsyRedirectUri(): string {
  const explicit = env("ETSY_REDIRECT_URI");
  if (explicit) return explicit;
  const base = (env("APP_BASE_URL") || "http://localhost:2626").replace(/\/$/, "");
  return `${base}/api/etsy/oauth/callback`;
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateOAuthState(): string {
  return base64Url(randomBytes(24));
}

export function buildEtsyAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const query = new URLSearchParams({
    response_type: "code",
    redirect_uri: resolveEtsyRedirectUri(),
    scope: getEtsyOAuthScopes(),
    client_id: getEtsyClientId(),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ETSY_CONNECT_URL}?${query.toString()}`;
}

type EtsyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function parseTokenResponse(
  json: EtsyTokenResponse,
  context: string
): Omit<StoredOAuthTokens, "shopId"> {
  if (!json.access_token || !json.refresh_token) {
    throw new Error(
      `Etsy ${context} failed: ${json.error ?? "no token in response"}${
        json.error_description ? ` — ${json.error_description}` : ""
      }`
    );
  }
  // access_token is "{user_id}.{token}"
  const userId = json.access_token.split(".")[0];
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    userId,
  };
}

async function postToken(
  body: Record<string, string>,
  context: string,
  fetchImpl: typeof fetch = fetch
): Promise<Omit<StoredOAuthTokens, "shopId">> {
  const res = await fetchImpl(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: EtsyTokenResponse = {};
  try {
    json = text ? (JSON.parse(text) as EtsyTokenResponse) : {};
  } catch {
    throw new Error(
      `Etsy ${context} failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Etsy ${context} failed (${res.status}): ${
        json.error_description ?? json.error ?? text.slice(0, 200)
      }`
    );
  }
  return parseTokenResponse(json, context);
}

export async function exchangeEtsyCode(
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch
): Promise<Omit<StoredOAuthTokens, "shopId">> {
  return postToken(
    {
      grant_type: "authorization_code",
      client_id: getEtsyClientId(),
      redirect_uri: resolveEtsyRedirectUri(),
      code,
      code_verifier: codeVerifier,
    },
    "code exchange",
    fetchImpl
  );
}

export async function refreshEtsyTokens(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<Omit<StoredOAuthTokens, "shopId">> {
  return postToken(
    {
      grant_type: "refresh_token",
      client_id: getEtsyClientId(),
      refresh_token: refreshToken,
    },
    "token refresh",
    fetchImpl
  );
}

export type EtsyIdentity = {
  userId: string;
  shopId?: string;
  shopName?: string;
};

/** GET /v3/application/users/me — resolves user_id + shop_id for the token. */
export async function fetchEtsyIdentity(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<EtsyIdentity> {
  const res = await fetchImpl(`${ETSY_API_BASE}/application/users/me`, {
    headers: {
      "x-api-key": getEtsyClientId(),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Etsy users/me failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as { user_id?: number; shop_id?: number };
  const identity: EtsyIdentity = {
    userId: json.user_id != null ? String(json.user_id) : "",
    shopId: json.shop_id != null ? String(json.shop_id) : undefined,
  };

  if (identity.shopId) {
    try {
      const shopRes = await fetchImpl(
        `${ETSY_API_BASE}/application/shops/${identity.shopId}`,
        {
          headers: {
            "x-api-key": getEtsyClientId(),
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (shopRes.ok) {
        const shop = (await shopRes.json()) as { shop_name?: string };
        identity.shopName = shop.shop_name;
      }
    } catch {
      /* shop name is best-effort */
    }
  }
  return identity;
}

/**
 * Returns a valid access token from backend storage, refreshing when expired.
 */
export async function getEtsyAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; shopId?: string; userId?: string }> {
  const { getValidAccessToken } = await import("./marketplaceTokenService");
  const tok = await getValidAccessToken("etsy", undefined, fetchImpl);
  return {
    accessToken: tok.accessToken,
    shopId: tok.shopId,
    userId: tok.userId,
  };
}
