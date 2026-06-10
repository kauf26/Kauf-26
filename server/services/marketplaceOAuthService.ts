import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { getOAuthProviderById } from "../config/oauthConfig";
import { env } from "./adapters/adapterUtils";
import {
  deleteMarketplaceTokens,
  loadMarketplaceTokens,
  saveMarketplaceTokens,
  type StoredMarketplaceTokens,
} from "./marketplaceAuthStorage";

export type OAuthMarketplaceId = "etsy" | "ebay" | "shopify";

const OAUTH_PLATFORMS: OAuthMarketplaceId[] = ["etsy", "ebay", "shopify"];

export function isOAuthMarketplace(id: string): id is OAuthMarketplaceId {
  return OAUTH_PLATFORMS.includes(id as OAuthMarketplaceId);
}

function webAppUrl(): string {
  return (env("CLIENT_URL") || "http://localhost:5173").replace(/\/$/, "");
}

function appBaseUrl(): string {
  return (
    env("APP_BASE_URL") ||
    `http://localhost:${env("PORT") || "2626"}`
  ).replace(/\/$/, "");
}

export function getWebOAuthRedirectUri(marketplaceId: string): string {
  return `${appBaseUrl()}/api/oauth/${marketplaceId}/callback`;
}

function getClientSecret(marketplaceId: OAuthMarketplaceId): string {
  if (marketplaceId === "ebay") {
    return env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID") || "";
  }
  if (marketplaceId === "shopify") {
    return env("SHOPIFY_CLIENT_SECRET") || "";
  }
  return env("ETSY_CLIENT_SECRET") || "";
}

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  if (!cleaned) throw new Error("Shop domain is required");
  return cleaned.includes(".") ? cleaned : `${cleaned}.myshopify.com`;
}

function resolveUrls(
  marketplaceId: OAuthMarketplaceId,
  shopDomain?: string
): { authUrl: string; tokenUrl: string } {
  const config = getOAuthProviderById(marketplaceId);
  if (!config) throw new Error(`OAuth not configured for ${marketplaceId}`);
  const shop = shopDomain ? normalizeShop(shopDomain) : "";
  return {
    authUrl: config.authUrl.replace("{shop}", shop),
    tokenUrl: config.tokenUrl.replace("{shop}", shop),
  };
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export type OAuthSessionState = {
  marketplace: OAuthMarketplaceId;
  state: string;
  codeVerifier?: string;
  shopDomain?: string;
  userId: number | null;
  returnTo: "web" | "mobile";
};

declare module "express-session" {
  interface SessionData {
    marketplaceOAuth?: OAuthSessionState;
  }
}

export function resolveOAuthUserId(req: Request): number | null {
  const user = req.user as { id?: number } | undefined;
  return typeof user?.id === "number" ? user.id : null;
}

export function buildAuthorizeUrl(
  marketplaceId: OAuthMarketplaceId,
  req: Request,
  options: { shopDomain?: string; returnTo?: "web" | "mobile" } = {}
): string {
  const config = getOAuthProviderById(marketplaceId);
  if (!config?.configured) {
    throw new Error(`${marketplaceId} OAuth is not configured on the server`);
  }

  if (marketplaceId === "shopify" && !options.shopDomain?.trim()) {
    throw new Error("Shop domain is required for Shopify OAuth");
  }

  const shopDomain =
    marketplaceId === "shopify" ? normalizeShop(options.shopDomain!) : options.shopDomain;
  const { authUrl } = resolveUrls(marketplaceId, shopDomain);
  const redirectUri = getWebOAuthRedirectUri(marketplaceId);
  const state = randomBytes(16).toString("hex");
  const returnTo = options.returnTo ?? "web";

  let codeVerifier: string | undefined;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  if (config.scopes.length) {
    params.set("scope", config.scopes.join(" "));
  }

  if (config.usePkce) {
    const pkce = pkcePair();
    codeVerifier = pkce.verifier;
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }

  if (marketplaceId === "ebay") {
    params.set("prompt", "login");
  }

  if (marketplaceId === "shopify" && shopDomain) {
    params.set("shop", shopDomain);
  }

  req.session.marketplaceOAuth = {
    marketplace: marketplaceId,
    state,
    codeVerifier,
    shopDomain,
    userId: resolveOAuthUserId(req),
    returnTo,
  };

  return `${authUrl}?${params.toString()}`;
}

function parseTokenResponse(
  json: Record<string, unknown>,
  marketplaceId: OAuthMarketplaceId,
  shopDomain?: string
): StoredMarketplaceTokens {
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Token response missing access_token");

  const expiresIn = Number(json.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    tokenType: json.token_type ? String(json.token_type) : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : undefined,
    expiresAt,
    shopDomain,
    accountLabel: shopDomain ?? marketplaceId,
    metadata: {
      userId:
        marketplaceId === "etsy"
          ? accessToken.split(".")[0]
          : json.user_id != null
            ? String(json.user_id)
            : undefined,
    },
  };
}

async function exchangeAuthorizationCode(
  marketplaceId: OAuthMarketplaceId,
  code: string,
  redirectUri: string,
  codeVerifier: string | undefined,
  shopDomain?: string
): Promise<StoredMarketplaceTokens> {
  const config = getOAuthProviderById(marketplaceId);
  if (!config) throw new Error(`OAuth not configured for ${marketplaceId}`);
  const { tokenUrl } = resolveUrls(marketplaceId, shopDomain);
  const secret = getClientSecret(marketplaceId);

  if (config.tokenExchange === "json_pkce") {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: config.clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier ?? "",
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, marketplaceId, shopDomain);
  }

  if (config.tokenExchange === "json_secret") {
    if (!secret) throw new Error("SHOPIFY_CLIENT_SECRET is not configured");
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: secret,
        code,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, marketplaceId, shopDomain);
  }

  if (config.tokenExchange === "form_basic") {
    if (!secret) throw new Error("EBAY_CLIENT_SECRET is not configured");
    const basic = Buffer.from(`${config.clientId}:${secret}`).toString("base64");
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, marketplaceId, shopDomain);
  }

  throw new Error(`Unsupported token exchange for ${marketplaceId}`);
}

async function refreshAccessToken(
  marketplaceId: OAuthMarketplaceId,
  refreshToken: string,
  shopDomain?: string
): Promise<StoredMarketplaceTokens> {
  const config = getOAuthProviderById(marketplaceId);
  if (!config) throw new Error(`OAuth not configured for ${marketplaceId}`);
  const { tokenUrl } = resolveUrls(marketplaceId, shopDomain);
  const secret = getClientSecret(marketplaceId);

  if (marketplaceId === "etsy") {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: refreshToken,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Refresh failed"));
    }
    return parseTokenResponse(json, marketplaceId, shopDomain);
  }

  if (marketplaceId === "shopify") {
    throw new Error("Shopify tokens do not refresh — re-authorize the app");
  }

  const basic = Buffer.from(`${config.clientId}:${secret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.error_description ?? json.error ?? "Refresh failed"));
  }
  return parseTokenResponse(json, marketplaceId, shopDomain);
}

export async function handleOAuthCallback(
  marketplaceId: OAuthMarketplaceId,
  req: Request
): Promise<{ redirectUrl: string }> {
  const pending = req.session.marketplaceOAuth;
  if (!pending || pending.marketplace !== marketplaceId) {
    throw new Error("OAuth session expired — start connect again");
  }

  const error = typeof req.query.error === "string" ? req.query.error : null;
  if (error) {
    throw new Error(error);
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code) throw new Error("Missing authorization code");
  if (state !== pending.state) throw new Error("Invalid OAuth state");

  const redirectUri = getWebOAuthRedirectUri(marketplaceId);
  const tokens = await exchangeAuthorizationCode(
    marketplaceId,
    code,
    redirectUri,
    pending.codeVerifier,
    pending.shopDomain
  );

  await saveMarketplaceTokens(marketplaceId, tokens, pending.userId);
  delete req.session.marketplaceOAuth;

  if (pending.returnTo === "mobile") {
    return {
      redirectUrl: `kauf26://oauth/${marketplaceId}?connected=1`,
    };
  }

  return {
    redirectUrl: `${webAppUrl()}/settings?connected=true&marketplace=${marketplaceId}`,
  };
}

export async function getValidAccessToken(
  marketplaceId: OAuthMarketplaceId,
  userId: number | null
): Promise<string | null> {
  const stored = await loadMarketplaceTokens(marketplaceId, userId);
  if (!stored?.accessToken) return null;

  const expiresAt = stored.expiresAt ? Date.parse(stored.expiresAt) : 0;
  const stillValid = !expiresAt || expiresAt > Date.now() + 60_000;
  if (stillValid) return stored.accessToken;

  if (!stored.refreshToken) return null;

  try {
    const refreshed = await refreshAccessToken(
      marketplaceId,
      stored.refreshToken,
      stored.shopDomain
    );
    await saveMarketplaceTokens(
      marketplaceId,
      { ...stored, ...refreshed },
      userId
    );
    return refreshed.accessToken;
  } catch (error) {
    console.error(`[OAuth] Refresh failed for ${marketplaceId}:`, error);
    return null;
  }
}

export async function disconnectMarketplace(
  marketplaceId: OAuthMarketplaceId,
  userId: number | null
): Promise<void> {
  await deleteMarketplaceTokens(marketplaceId, userId);
}

export function oauthFailureRedirect(
  marketplaceId: string,
  message: string,
  returnTo: "web" | "mobile" = "web"
): string {
  if (returnTo === "mobile") {
    return `kauf26://oauth/${marketplaceId}?connected=0&reason=${encodeURIComponent(message)}`;
  }
  return `${webAppUrl()}/settings?connected=false&marketplace=${marketplaceId}&reason=${encodeURIComponent(message)}`;
}
