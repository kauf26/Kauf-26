/**
 * Shopify OAuth 2.0 (authorization code grant + refresh token).
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */
import { env } from "./adapters/adapterUtils";
import type { StoredOAuthTokens } from "./tokenStorage";

const DEFAULT_SCOPES = "read_products,write_products";

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function getShopifyClientId(): string {
  return env("SHOPIFY_CLIENT_ID");
}

export function getShopifyClientSecret(): string {
  return env("SHOPIFY_CLIENT_SECRET");
}

export function resolveShopifyAppBaseUrl(): string {
  const raw =
    trimEnv("SHOPIFY_APP_BASE_URL") ||
    trimEnv("APP_BASE_URL") ||
    "http://localhost:2626";
  return raw.replace(/\/$/, "");
}

export function resolveShopifyRedirectUri(): string {
  const explicit = trimEnv("SHOPIFY_OAUTH_REDIRECT_URI");
  if (explicit) return explicit;
  return `${resolveShopifyAppBaseUrl()}/api/shopify/oauth/callback`;
}

export function getShopifyOAuthScopes(): string {
  const fromEnv = trimEnv("SHOPIFY_OAUTH_SCOPES");
  return fromEnv || DEFAULT_SCOPES;
}

/** Normalize to `your-store.myshopify.com`. */
export function normalizeShopifyDomain(raw: string): string {
  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  if (!cleaned) throw new Error("Shop domain is required");
  if (cleaned.includes(".")) return cleaned;
  return `${cleaned}.myshopify.com`;
}

export function buildShopifyAuthorizeUrl(params: {
  shopDomain: string;
  state: string;
  scopes?: string;
}): string {
  const shop = normalizeShopifyDomain(params.shopDomain);
  const query = new URLSearchParams({
    client_id: getShopifyClientId(),
    scope: params.scopes ?? getShopifyOAuthScopes(),
    redirect_uri: resolveShopifyRedirectUri(),
    state: params.state,
  });
  return `https://${shop}/admin/oauth/authorize?${query.toString()}`;
}

type ShopifyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

function parseShopifyTokenResponse(
  json: ShopifyTokenResponse,
  context: string
): Omit<StoredOAuthTokens, "shopDomain"> {
  if (!json.access_token) {
    throw new Error(
      `Shopify ${context} failed: ${json.error ?? "no access_token"}${
        json.error_description ? ` — ${json.error_description}` : ""
      }`
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + (json.expires_in ?? 86399) * 1000,
    scope: json.scope,
  };
}

async function postShopifyToken(
  shopDomain: string,
  body: Record<string, string>,
  context: string,
  fetchImpl: typeof fetch = fetch
): Promise<Omit<StoredOAuthTokens, "shopDomain">> {
  const shop = normalizeShopifyDomain(shopDomain);
  const res = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: ShopifyTokenResponse = {};
  try {
    json = text ? (JSON.parse(text) as ShopifyTokenResponse) : {};
  } catch {
    throw new Error(`Shopify ${context} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `Shopify ${context} failed (${res.status}): ${
        json.error_description ?? json.error ?? text.slice(0, 200)
      }`
    );
  }
  return parseShopifyTokenResponse(json, context);
}

export async function exchangeShopifyCode(
  shopDomain: string,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<StoredOAuthTokens> {
  const tokens = await postShopifyToken(
    shopDomain,
    {
      client_id: getShopifyClientId(),
      client_secret: getShopifyClientSecret(),
      code,
    },
    "code exchange",
    fetchImpl
  );
  const shop = normalizeShopifyDomain(shopDomain);
  return {
    ...tokens,
    shopDomain: shop,
    accountName: shop,
  };
}

export async function refreshShopifyOAuthTokens(
  shopDomain: string,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<Partial<StoredOAuthTokens>> {
  if (!refreshToken) {
    throw new Error(
      "No Shopify refresh token stored — re-connect via /api/shopify/oauth/start"
    );
  }
  const tokens = await postShopifyToken(
    shopDomain,
    {
      client_id: getShopifyClientId(),
      client_secret: getShopifyClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    "token refresh",
    fetchImpl
  );
  return { ...tokens, shopDomain: normalizeShopifyDomain(shopDomain) };
}

export async function fetchShopifyShopName(
  shopDomain: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | undefined> {
  const shop = normalizeShopifyDomain(shopDomain);
  const res = await fetchImpl(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as { shop?: { name?: string } };
  return json.shop?.name;
}

export async function getShopifyAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; shopDomain: string; accountName?: string }> {
  const { getValidAccessToken } = await import("./marketplaceTokenService");
  const tok = await getValidAccessToken("shopify", undefined, fetchImpl);
  if (!tok.shopDomain) {
    throw new Error("Shopify shop domain missing — re-connect via /api/shopify/oauth/start");
  }
  return {
    accessToken: tok.accessToken,
    shopDomain: tok.shopDomain,
    accountName: tok.accountName,
  };
}
