/**
 * Shopify Admin API helpers — REST + client_credentials token refresh.
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */

import { randomUUID } from "node:crypto";

import { env, hasEnv } from "./adapters/adapterUtils";

const API_VERSION = "2024-10";

const DEFAULT_OAUTH_SCOPES = ["read_products", "write_products"] as const;

/** Local dev app origin — override with APP_BASE_URL or SHOPIFY_APP_BASE_URL in .env. */
const DEFAULT_APP_BASE_URL = "http://localhost:2626";

const SHOPIFY_OAUTH_CALLBACK_PATH = "/api/shopify/oauth/callback";
const SHOPIFY_OAUTH_AUTHORIZE_PATH = "/api/shopify/oauth/authorize";

const SCOPE_APPROVAL_RE =
  /merchant approval for ([a-z0-9_]+) scope/gi;

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export type ShopifyConfig = {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
};

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

/** Thrown when Shopify returns 403 because the merchant has not approved API scopes. */
export class ShopifyScopeApprovalRequiredError extends ShopifyApiError {
  readonly missingScopes: string[];
  readonly authorizeUrl: string | null;
  readonly reauthorizeMessage: string;

  constructor(params: {
    status: number;
    body: string;
    missingScopes: string[];
    authorizeUrl: string | null;
  }) {
    const scopeList =
      params.missingScopes.length > 0
        ? params.missingScopes.join(", ")
        : "required API scopes";

    const reauthorizeMessage = params.authorizeUrl
      ? [
          `Merchant approval is required for: ${scopeList}.`,
          "Re-authorize the app by opening this URL in a browser (store owner must approve):",
          params.authorizeUrl,
          "",
          "After approval, update SHOPIFY_ACCESS_TOKEN in .env with the new token from your OAuth callback.",
        ].join("\n")
      : [
          `Merchant approval is required for: ${scopeList}.`,
          "Set SHOPIFY_OAUTH_REDIRECT_URI in .env (must match a URL allowed in your Shopify app settings),",
          `then re-run this command or visit ${resolveShopifyOAuthAuthorizeUrl()} in a browser.`,
          "",
          "Alternatively, add the missing scopes in Shopify Partners → your app → API access, reinstall on the store,",
          "and refresh SHOPIFY_ACCESS_TOKEN via client_credentials or OAuth.",
        ].join("\n");

    super(reauthorizeMessage, params.status, params.body);
    this.name = "ShopifyScopeApprovalRequiredError";
    this.missingScopes = params.missingScopes;
    this.authorizeUrl = params.authorizeUrl;
    this.reauthorizeMessage = reauthorizeMessage;
  }
}

/** Public app origin for OAuth links (no trailing slash). */
export function resolveShopifyAppBaseUrl(): string {
  const raw =
    trimEnv("SHOPIFY_APP_BASE_URL") ||
    trimEnv("APP_BASE_URL") ||
    DEFAULT_APP_BASE_URL;
  return raw.replace(/\/$/, "");
}

/** OAuth callback URL — explicit env wins, else derived from app base URL. */
export function resolveShopifyOAuthRedirectUri(): string {
  const explicit = trimEnv("SHOPIFY_OAUTH_REDIRECT_URI");
  if (explicit) return explicit;
  return `${resolveShopifyAppBaseUrl()}${SHOPIFY_OAUTH_CALLBACK_PATH}`;
}

/** Full URL merchants open to approve missing scopes. */
export function resolveShopifyOAuthAuthorizeUrl(): string {
  return `${resolveShopifyAppBaseUrl()}${SHOPIFY_OAUTH_AUTHORIZE_PATH}`;
}

/** Normalize store to `your-store.myshopify.com`. */
export function resolveShopifyStoreDomain(): string {
  const raw =
    trimEnv("SHOPIFY_STORE_NAME") ||
    trimEnv("SHOPIFY_SHOP_DOMAIN") ||
    trimEnv("SHOPIFY_STORE_DOMAIN");

  if (!raw) {
    throw new ShopifyApiError(
      "Missing SHOPIFY_STORE_NAME (or SHOPIFY_SHOP_DOMAIN) in environment",
      0
    );
  }

  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (cleaned.includes(".")) {
    return cleaned;
  }
  return `${cleaned}.myshopify.com`;
}

export function loadShopifyConfigFromEnv(): ShopifyConfig {
  const storeDomain = resolveShopifyStoreDomain();
  const clientId = trimEnv("SHOPIFY_CLIENT_ID");
  const clientSecret = trimEnv("SHOPIFY_CLIENT_SECRET");
  const accessToken = trimEnv("SHOPIFY_ACCESS_TOKEN");

  if (!clientId || !clientSecret) {
    throw new ShopifyApiError(
      "Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET in environment",
      0
    );
  }
  if (!accessToken) {
    throw new ShopifyApiError(
      "Missing SHOPIFY_ACCESS_TOKEN in environment (or refresh via client_credentials first)",
      0
    );
  }

  return { storeDomain, clientId, clientSecret, accessToken };
}

export function isShopifyEnvConfigured(): boolean {
  try {
    loadShopifyConfigFromEnv();
    return true;
  } catch {
    return false;
  }
}

/** Extract scope names from Shopify 403 bodies (JSON or plain text). */
export function parseShopifyScopeApprovalError(body: string): string[] {
  let text = body;
  try {
    const json = JSON.parse(body) as {
      errors?: string | string[] | Record<string, string[]>;
      error?: string;
      error_description?: string;
    };
    if (typeof json.errors === "string") {
      text = json.errors;
    } else if (Array.isArray(json.errors)) {
      text = json.errors.join(" ");
    } else if (json.errors && typeof json.errors === "object") {
      text = Object.values(json.errors).flat().join(" ");
    } else if (typeof json.error_description === "string") {
      text = json.error_description;
    } else if (typeof json.error === "string") {
      text = json.error;
    }
  } catch {
    /* use raw body */
  }

  const scopes = new Set<string>();
  for (const match of text.matchAll(SCOPE_APPROVAL_RE)) {
    if (match[1]) scopes.add(match[1].toLowerCase());
  }
  return [...scopes];
}

export function isShopifyScopeApprovalError(
  status: number,
  body: string
): boolean {
  if (status !== 403) return false;
  if (parseShopifyScopeApprovalError(body).length > 0) return true;
  return /merchant approval for .+ scope/i.test(body);
}

/** Comma-separated OAuth scopes — merges env defaults with any scopes Shopify reported missing. */
export function getShopifyOAuthScopes(missing?: string[]): string {
  const fromEnv = trimEnv("SHOPIFY_OAUTH_SCOPES");
  const base = fromEnv
    ? fromEnv.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_OAUTH_SCOPES];
  const merged = new Set([...base, ...(missing ?? [])]);
  return [...merged].join(",");
}

/**
 * Build the Shopify Admin OAuth authorize URL so the merchant can approve scopes.
 * Returns null when SHOPIFY_OAUTH_REDIRECT_URI is not configured.
 */
export function buildShopifyOAuthAuthorizeUrl(
  config: Pick<ShopifyConfig, "storeDomain" | "clientId">,
  options?: { scopes?: string; redirectUri?: string; state?: string }
): string | null {
  const redirectUri = options?.redirectUri ?? resolveShopifyOAuthRedirectUri();
  if (!redirectUri) return null;

  const scopes = options?.scopes ?? getShopifyOAuthScopes();
  const state = options?.state ?? randomUUID();

  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${config.storeDomain}/admin/oauth/authorize?${params.toString()}`;
}

function throwShopifyAdminResponseError(
  res: Response,
  text: string,
  config: ShopifyConfig,
  context: string
): never {
  if (isShopifyScopeApprovalError(res.status, text)) {
    const missing = parseShopifyScopeApprovalError(text);
    const authorizeUrl = buildShopifyOAuthAuthorizeUrl(config, {
      scopes: getShopifyOAuthScopes(missing),
    });
    throw new ShopifyScopeApprovalRequiredError({
      status: res.status,
      body: text,
      missingScopes:
        missing.length > 0
          ? missing
          : getShopifyOAuthScopes().split(",").filter(Boolean),
      authorizeUrl,
    });
  }

  throw new ShopifyApiError(
    `Shopify ${context} failed (${res.status}): ${text.slice(0, 300)}`,
    res.status,
    text
  );
}

function adminBaseUrl(storeDomain: string): string {
  return `https://${storeDomain}/admin/api/${API_VERSION}`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
};

/**
 * Exchange client ID + secret for a new Admin API access token (24h lifetime).
 * Requires app installed on a store you own (dev store or permitted shop).
 */
export async function refreshShopifyAccessToken(
  config: Pick<ShopifyConfig, "storeDomain" | "clientId" | "clientSecret">,
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; expiresIn?: number; scope?: string }> {
  const url = `https://${config.storeDomain}/admin/oauth/access_token`;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const text = await res.text();
  let json: TokenResponse = {};
  try {
    json = text ? (JSON.parse(text) as TokenResponse) : {};
  } catch {
    /* use raw text in error */
  }

  if (!res.ok) {
    throw new ShopifyApiError(
      `Shopify token refresh failed (${res.status}): ${text.slice(0, 300)}`,
      res.status,
      text
    );
  }

  if (!json.access_token) {
    throw new ShopifyApiError(
      "Shopify token response missing access_token",
      res.status,
      text
    );
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

async function shopifyAdminRequest(
  config: ShopifyConfig,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  allowRetry = true
): Promise<Response> {
  const url = `${adminBaseUrl(config.storeDomain)}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("X-Shopify-Access-Token", config.accessToken);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetchImpl(url, { ...init, headers });

  if (res.status === 401 && allowRetry) {
    const refreshed = await refreshShopifyAccessToken(config, fetchImpl);
    config.accessToken = refreshed.accessToken;
    process.env.SHOPIFY_ACCESS_TOKEN = refreshed.accessToken;
    return shopifyAdminRequest(config, path, init, fetchImpl, false);
  }

  return res;
}

export type ShopifyProductSummary = {
  id: number;
  title: string;
  status?: string;
};

/** Fetch products via Admin REST API (first page). */
export async function fetchShopifyProducts(
  config: ShopifyConfig,
  limit = 5,
  fetchImpl: typeof fetch = fetch
): Promise<ShopifyProductSummary[]> {
  const res = await shopifyAdminRequest(
    config,
    `/products.json?limit=${Math.min(Math.max(limit, 1), 250)}`,
    { method: "GET" },
    fetchImpl
  );

  const text = await res.text();
  if (!res.ok) {
    throwShopifyAdminResponseError(res, text, config, "products request");
  }

  const json = JSON.parse(text) as {
    products?: Array<{ id?: number; title?: string; status?: string }>;
  };

  return (json.products ?? [])
    .filter((p) => p.id != null && p.title)
    .map((p) => ({
      id: p.id!,
      title: p.title!,
      status: p.status,
    }));
}

/** Returns the first product title, or null if the catalog is empty. */
export async function fetchFirstShopifyProductTitle(
  config: ShopifyConfig,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const products = await fetchShopifyProducts(config, 1, fetchImpl);
  return products[0]?.title ?? null;
}

// ---------------------------------------------------------------------------
// Standardized service-layer interface (matches ebayApi.ts / etsyApi.ts)
// ---------------------------------------------------------------------------

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

/**
 * Publish-ready credentials: access token + store identity.
 * Accepts either SHOPIFY_SHOP_DOMAIN or SHOPIFY_STORE_NAME (placeholder-filtered).
 */
export function isShopifyConfigured(): boolean {
  return (
    hasEnv("SHOPIFY_ACCESS_TOKEN") &&
    (hasEnv("SHOPIFY_SHOP_DOMAIN") || hasEnv("SHOPIFY_STORE_NAME"))
  );
}

/**
 * Verify Shopify credentials with a 1-product Admin API read.
 * Maps scope-approval 403s to an actionable message with the OAuth URL.
 */
export async function verifyShopifyConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  if (!isShopifyConfigured()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message:
        "Missing SHOPIFY_ACCESS_TOKEN or store domain (SHOPIFY_SHOP_DOMAIN / SHOPIFY_STORE_NAME) — add them to .env and restart the server",
    };
  }

  const config: ShopifyConfig = {
    storeDomain: resolveShopifyStoreDomain(),
    clientId: env("SHOPIFY_CLIENT_ID"),
    clientSecret: env("SHOPIFY_CLIENT_SECRET"),
    accessToken: env("SHOPIFY_ACCESS_TOKEN"),
  };

  try {
    const products = await fetchShopifyProducts(config, 1, fetchImpl);
    return {
      ok: true,
      configured: true,
      status: 200,
      message: `Shopify Admin API verified for ${config.storeDomain}`,
      detail: { sampleProduct: products[0] ?? null },
    };
  } catch (error) {
    if (error instanceof ShopifyScopeApprovalRequiredError) {
      return {
        ok: false,
        configured: true,
        status: error.status,
        message: error.reauthorizeMessage,
        detail: {
          missingScopes: error.missingScopes,
          authorizeUrl: error.authorizeUrl,
        },
      };
    }
    if (error instanceof ShopifyApiError) {
      return {
        ok: false,
        configured: true,
        status: error.status,
        message: error.message,
        detail: error.body ? { body: error.body.slice(0, 500) } : undefined,
      };
    }
    return {
      ok: false,
      configured: true,
      status: 0,
      message: `Shopify verify failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
