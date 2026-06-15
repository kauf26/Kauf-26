/**
 * Stateless server-side OAuth authorization-code exchange for secret-required marketplaces.
 * Returns tokens to the client — never persists them on the server.
 */
import { getOAuthManifestEntry } from "../../shared/marketplaceOAuthManifest";
import { manifestEntryToProviderConfig } from "../../shared/marketplaceOAuthRegistry";
import { getOAuthRedirectUri } from "../../shared/oauthRedirect";
import type { MarketplaceOAuthProviderConfig } from "../../shared/marketplaceOAuthTypes";
import { env } from "./adapters/adapterUtils";
import { exchangeMockCode, isMockOAuthMode } from "./oauth/mockOAuth";
import type { TokenResponse } from "./oauth/types";

export type MarketplaceExchangeContext = {
  redirectUri: string;
  codeVerifier?: string;
  shopDomain?: string;
  siteUrl?: string;
  baseUrl?: string;
  userId?: number | null;
};

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  if (!cleaned) throw new Error("Shop domain is required");
  return cleaned.includes(".") ? cleaned : `${cleaned}.myshopify.com`;
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
}

function resolveProviderUrls(
  config: MarketplaceOAuthProviderConfig,
  ctx: MarketplaceExchangeContext
): { authUrl: string; tokenUrl: string; userInfoUrl: string } {
  const shop = ctx.shopDomain ? normalizeShop(ctx.shopDomain) : "";
  const site = ctx.siteUrl ? normalizeSiteUrl(ctx.siteUrl) : "";
  const base = ctx.baseUrl ? normalizeSiteUrl(ctx.baseUrl) : "";
  const sub = (url: string) =>
    url.replace("{shop}", shop).replace("{site}", site).replace("{base}", base);
  return {
    authUrl: sub(config.authUrl),
    tokenUrl: sub(config.tokenUrl),
    userInfoUrl: sub(config.userInfoUrl),
  };
}

/** Resolve server-side client secret env vars (never EXPO_PUBLIC_*). */
export function resolveServerClientSecret(marketplaceId: string): string {
  const id = marketplaceId.toLowerCase();
  const entry = getOAuthManifestEntry(id);
  const keys: string[] = [];

  if (entry?.mobileClientSecretEnv) {
    keys.push(entry.mobileClientSecretEnv.replace(/^EXPO_PUBLIC_/, ""));
  }

  const upper = id.toUpperCase().replace(/-/g, "_");
  keys.push(
    `${upper}_CLIENT_SECRET`,
    `${upper}_APP_SECRET`,
    `${upper}_SECRET`,
    `${upper}_CERT_ID`
  );

  if (id === "ebay") {
    keys.unshift("EBAY_CLIENT_SECRET", "EBAY_CERT_ID");
  }
  if (id === "shopify") {
    keys.unshift("SHOPIFY_CLIENT_SECRET");
  }
  if (id === "etsy") {
    keys.unshift("ETSY_CLIENT_SECRET");
  }
  if (id === "amazon") {
    keys.unshift("AMAZON_CLIENT_SECRET");
  }
  if (id === "shopee") {
    keys.push("SHOPEE_PARTNER_KEY");
  }

  for (const key of keys) {
    const value = env(key);
    if (value?.trim()) return value.trim();
  }

  return "";
}

function parseTokenResponse(
  json: Record<string, unknown>,
  marketplaceId: string,
  shopDomain?: string
): TokenResponse {
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Token response missing access_token");

  const expiresIn = Number(json.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  let marketplaceShopId: string | undefined;
  if (marketplaceId === "etsy") {
    marketplaceShopId = accessToken.split(".")[0];
  } else if (json.user_id != null) {
    marketplaceShopId = String(json.user_id);
  }

  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    tokenType: json.token_type ? String(json.token_type) : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : undefined,
    expiresAt,
    shopDomain,
    marketplaceShopId,
    accountLabel: shopDomain ?? marketplaceId,
    metadata: {
      userId: marketplaceShopId,
    },
  };
}

async function exchangeWithProviderConfig(
  config: MarketplaceOAuthProviderConfig,
  code: string,
  ctx: MarketplaceExchangeContext
): Promise<TokenResponse> {
  const { tokenUrl } = resolveProviderUrls(config, ctx);
  const secret = resolveServerClientSecret(config.id);

  if (config.tokenExchange === "json_pkce") {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: config.clientId,
        redirect_uri: ctx.redirectUri,
        code,
        code_verifier: ctx.codeVerifier ?? "",
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, config.id, ctx.shopDomain);
  }

  if (config.tokenExchange === "json_secret") {
    if (!secret) {
      throw new Error(`${config.id.toUpperCase()} client secret is not configured on the server`);
    }
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
    return parseTokenResponse(json, config.id, ctx.shopDomain);
  }

  if (config.tokenExchange === "form_basic") {
    if (!secret) {
      throw new Error(`${config.id.toUpperCase()} client secret is not configured on the server`);
    }
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
        redirect_uri: ctx.redirectUri,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, config.id, ctx.shopDomain);
  }

  if (config.tokenExchange === "form_secret" || !config.tokenExchange) {
    const needsSecret =
      config.oauthFlow !== "authorization_code_pkce" &&
      config.tokenExchange !== "json_pkce";
    if (needsSecret && !secret) {
      throw new Error(`${config.id.toUpperCase()} client secret is not configured on the server`);
    }

    const params: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: ctx.redirectUri,
      client_id: config.clientId,
    };
    if (secret) params.client_secret = secret;
    if (ctx.codeVerifier) params.code_verifier = ctx.codeVerifier;

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(params),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, config.id, ctx.shopDomain);
  }

  throw new Error(`Unsupported token exchange for ${config.id}`);
}

export function isOAuthExchangeSupported(marketplaceId: string): boolean {
  return Boolean(getOAuthManifestEntry(marketplaceId)?.oauthSupported);
}

export async function exchangeMarketplaceAuthorizationCode(
  marketplaceId: string,
  code: string,
  ctx: MarketplaceExchangeContext
): Promise<TokenResponse> {
  const id = marketplaceId.toLowerCase();
  if (!isOAuthExchangeSupported(id)) {
    throw new Error(`OAuth exchange is not supported for ${marketplaceId}`);
  }

  if (isMockOAuthMode() || code.startsWith("mock_")) {
    return exchangeMockCode(id as "etsy" | "ebay" | "shopify" | "amazon", ctx.userId ?? null);
  }

  const entry = getOAuthManifestEntry(id);
  if (!entry) throw new Error(`Unknown marketplace: ${marketplaceId}`);

  const config = manifestEntryToProviderConfig(entry);
  if (!config.clientId) {
    throw new Error(`${config.name} OAuth is not configured on the server`);
  }

  const canonicalRedirect = getOAuthRedirectUri(id);
  if (ctx.redirectUri !== canonicalRedirect) {
    throw new Error(`redirectUri must be ${canonicalRedirect}`);
  }

  if (config.requiresShopDomain && !ctx.shopDomain?.trim()) {
    throw new Error("Shop domain is required");
  }

  return exchangeWithProviderConfig(config, code, ctx);
}
