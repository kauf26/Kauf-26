/**
 * Universal OAuth service — provider-agnostic Authorization Code flow.
 * Provider-specific token exchange is encapsulated in the factory below.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { getOAuthConfigFor } from "../config/oauthConfig";
import { env } from "./adapters/adapterUtils";
import {
  deleteConnectionTokens,
  loadConnectionTokens,
  saveConnectionTokens,
  type StoredConnectionTokens,
} from "./oauthConnectionStorage";
import {
  clearMockTokens,
  exchangeMockCode,
  getMockAccessToken,
  getMockAuthUrl,
  isMockOAuthMode,
  listMockConnected,
} from "./oauth/mockOAuth";
import {
  refreshLockKey,
  withTokenRefreshLock,
} from "./oauth/tokenRefreshLock";
import type {
  EncodedOAuthState,
  OAuthConnectOptions,
  OAuthPendingSession,
  OAuthProviderId,
  TokenResponse,
} from "./oauth/types";
import { isUniversalOAuthProvider, UNIVERSAL_OAUTH_PROVIDERS } from "./oauth/types";

export type { OAuthProviderId, TokenResponse, OAuthConnectOptions };
export { isUniversalOAuthProvider, UNIVERSAL_OAUTH_PROVIDERS };

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_SKEW_MS = 60_000;

declare module "express-session" {
  interface SessionData {
    oauthPending?: OAuthPendingSession;
    /** @deprecated */
    marketplaceOAuth?: OAuthPendingSession & { marketplace?: OAuthProviderId };
  }
}

function webAppUrl(): string {
  return (env("CLIENT_URL") || "http://localhost:5173").replace(/\/$/, "");
}

function appBaseUrl(): string {
  return (env("APP_BASE_URL") || `http://localhost:${env("PORT") || "2626"}`).replace(
    /\/$/,
    ""
  );
}

/** Unified server callback — register in every marketplace developer portal. */
export function getUnifiedOAuthRedirectUri(): string {
  return `${appBaseUrl()}/api/auth/callback`;
}

/** Legacy per-provider callback (backward compatible). */
export function getLegacyOAuthRedirectUri(provider: string): string {
  return `${appBaseUrl()}/api/oauth/${provider}/callback`;
}

export function resolveOAuthUserId(req: Request): number | null {
  const user = req.user as { id?: number } | undefined;
  return typeof user?.id === "number" ? user.id : null;
}

export function encodeOAuthState(payload: EncodedOAuthState): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeOAuthState(state: string): EncodedOAuthState {
  const parsed = JSON.parse(
    Buffer.from(state, "base64url").toString("utf8")
  ) as EncodedOAuthState;
  if (!parsed?.p || !parsed?.n || !isUniversalOAuthProvider(parsed.p)) {
    throw new Error("Invalid OAuth state payload");
  }
  return parsed;
}

function getClientSecret(provider: OAuthProviderId): string {
  if (provider === "ebay") {
    return env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID") || "";
  }
  if (provider === "shopify") {
    return env("SHOPIFY_CLIENT_SECRET") || "";
  }
  if (provider === "amazon") {
    return env("AMAZON_CLIENT_SECRET") || "";
  }
  return env("ETSY_CLIENT_SECRET") || "";
}

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  if (!cleaned) throw new Error("Shop domain is required");
  return cleaned.includes(".") ? cleaned : `${cleaned}.myshopify.com`;
}

function resolveUrls(
  provider: OAuthProviderId,
  shopDomain?: string
): { authUrl: string; tokenUrl: string } {
  const config = getOAuthConfigFor(provider);
  if (!config) throw new Error(`OAuth not configured for ${provider}`);
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

function parseTokenResponse(
  json: Record<string, unknown>,
  provider: OAuthProviderId,
  shopDomain?: string
): TokenResponse {
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
    marketplaceShopId:
      provider === "etsy"
        ? accessToken.split(".")[0]
        : json.user_id != null
          ? String(json.user_id)
          : undefined,
    accountLabel: shopDomain ?? provider,
    metadata: {
      userId:
        provider === "etsy"
          ? accessToken.split(".")[0]
          : json.user_id != null
            ? String(json.user_id)
            : undefined,
    },
  };
}

function isProviderConfigured(provider: OAuthProviderId): boolean {
  if (isMockOAuthMode()) return true;
  const config = getOAuthConfigFor(provider);
  if (!config?.clientId) return false;
  if (provider === "etsy") return Boolean(getClientSecret(provider));
  if (provider === "shopify") return Boolean(getClientSecret(provider));
  if (provider === "ebay") return Boolean(getClientSecret(provider));
  if (provider === "amazon") return Boolean(getClientSecret(provider));
  return true;
}

export function isOAuthProviderConfigured(provider: string): boolean {
  return isUniversalOAuthProvider(provider) && isProviderConfigured(provider);
}

export function validateShopifyCallbackHmac(req: Request): void {
  const secret = getClientSecret("shopify");
  if (!secret) return;

  const query = req.query as Record<string, unknown>;
  const hmac = typeof query.hmac === "string" ? query.hmac : "";
  if (!hmac) return;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "hmac" || value == null) continue;
    params[key] = String(value);
  }

  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const digest = createHmac("sha256", secret).update(message).digest("hex");

  try {
    const valid = timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
    if (!valid) throw new Error("Invalid Shopify HMAC signature");
  } catch {
    throw new Error("Invalid Shopify HMAC signature");
  }
}

/**
 * Generate authorization URL for a marketplace provider.
 */
export function getAuthUrl(
  provider: string,
  userId: number | null,
  req: Request,
  options: OAuthConnectOptions = {}
): string {
  if (!isUniversalOAuthProvider(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  if (!isProviderConfigured(provider)) {
    throw new Error(`${provider} OAuth is not configured on the server`);
  }

  if (provider === "shopify" && !options.shopDomain?.trim()) {
    throw new Error("Shop domain is required for Shopify OAuth");
  }

  const shopDomain =
    provider === "shopify" ? normalizeShop(options.shopDomain!) : options.shopDomain;
  const nonce = randomBytes(16).toString("hex");
  const state = encodeOAuthState({ p: provider, n: nonce, u: userId });
  const returnTo = options.returnTo ?? "web";

  if (isMockOAuthMode()) {
    req.session.oauthPending = {
      provider,
      state,
      nonce,
      shopDomain,
      userId,
      returnTo,
    };
    return getMockAuthUrl(provider, state, appBaseUrl());
  }

  const config = getOAuthConfigFor(provider)!;
  const { authUrl } = resolveUrls(provider, shopDomain);
  const redirectUri = getUnifiedOAuthRedirectUri();

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

  if (provider === "ebay") {
    params.set("prompt", "login");
  }

  if (provider === "shopify" && shopDomain) {
    params.set("shop", shopDomain);
  }

  req.session.oauthPending = {
    provider,
    state,
    nonce,
    codeVerifier,
    shopDomain,
    userId,
    returnTo,
  };

  return `${authUrl}?${params.toString()}`;
}

async function exchangeAuthorizationCode(
  provider: OAuthProviderId,
  code: string,
  redirectUri: string,
  codeVerifier: string | undefined,
  shopDomain?: string
): Promise<TokenResponse> {
  const config = getOAuthConfigFor(provider);
  if (!config) throw new Error(`OAuth not configured for ${provider}`);
  const { tokenUrl } = resolveUrls(provider, shopDomain);
  const secret = getClientSecret(provider);

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
    return parseTokenResponse(json, provider, shopDomain);
  }

  if (config.tokenExchange === "json_secret") {
    if (!secret) throw new Error(`${provider.toUpperCase()}_CLIENT_SECRET is not configured`);
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
    return parseTokenResponse(json, provider, shopDomain);
  }

  if (config.tokenExchange === "form_secret") {
    if (!secret) throw new Error(`${provider.toUpperCase()}_CLIENT_SECRET is not configured`);
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: secret,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Token exchange failed"));
    }
    return parseTokenResponse(json, provider, shopDomain);
  }

  if (config.tokenExchange === "form_basic") {
    if (!secret) throw new Error(`${provider.toUpperCase()}_CLIENT_SECRET is not configured`);
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
    return parseTokenResponse(json, provider, shopDomain);
  }

  throw new Error(`Unsupported token exchange for ${provider}`);
}

export async function exchangeCode(
  provider: string,
  code: string,
  userId: number | null,
  context: {
    redirectUri?: string;
    codeVerifier?: string;
    shopDomain?: string;
  } = {}
): Promise<TokenResponse> {
  if (!isUniversalOAuthProvider(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  if (isMockOAuthMode() || code.startsWith("mock_")) {
    return exchangeMockCode(provider, userId);
  }

  const redirectUri = context.redirectUri ?? getUnifiedOAuthRedirectUri();
  return exchangeAuthorizationCode(
    provider,
    code,
    redirectUri,
    context.codeVerifier,
    context.shopDomain
  );
}

export async function refreshToken(
  provider: string,
  refreshTokenValue: string,
  context: { shopDomain?: string; userId?: number | null } = {}
): Promise<TokenResponse> {
  if (!isUniversalOAuthProvider(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  if (isMockOAuthMode()) {
    return exchangeMockCode(provider, context.userId ?? null);
  }

  const config = getOAuthConfigFor(provider);
  if (!config) throw new Error(`OAuth not configured for ${provider}`);
  const { tokenUrl } = resolveUrls(provider, context.shopDomain);
  const secret = getClientSecret(provider);

  if (provider === "etsy") {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: refreshTokenValue,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? "Refresh failed"));
    }
    console.info(`[OAuth] Token refreshed for provider=${provider} userId=${context.userId ?? "anon"}`);
    return parseTokenResponse(json, provider, context.shopDomain);
  }

  if (provider === "shopify") {
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
      refresh_token: refreshTokenValue,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`[OAuth] Refresh failed for provider=${provider}:`, json);
    throw new Error(String(json.error_description ?? json.error ?? "Refresh failed"));
  }
  console.info(`[OAuth] Token refreshed for provider=${provider} userId=${context.userId ?? "anon"}`);
  return parseTokenResponse(json, provider, context.shopDomain);
}

export async function revokeAccess(
  provider: string,
  userId: number | null
): Promise<void> {
  if (!isUniversalOAuthProvider(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  if (isMockOAuthMode()) {
    clearMockTokens(userId, provider);
    return;
  }
  await deleteConnectionTokens(provider, userId);
  console.info(`[OAuth] Revoked access provider=${provider} userId=${userId ?? "anon"}`);
}

function resolvePendingSession(req: Request): OAuthPendingSession | null {
  return req.session.oauthPending ?? null;
}

export async function handleUnifiedCallback(
  req: Request
): Promise<{ redirectUrl: string; provider: OAuthProviderId }> {
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;
  if (oauthError) throw new Error(oauthError);

  /** MOCK_OAUTH_MODE: mock_* codes bypass session DB/encryption requirements. */
  if (isMockOAuthMode() && code.startsWith("mock_")) {
    let provider: OAuthProviderId | null = null;
    try {
      provider = decodeOAuthState(stateRaw).p;
    } catch {
      const fromCode = code.slice("mock_".length).toLowerCase();
      if (isUniversalOAuthProvider(fromCode)) {
        provider = fromCode;
      }
    }

    const pending = resolvePendingSession(req);
    if (!provider && pending) {
      provider = pending.provider;
    }
    if (!provider || !isUniversalOAuthProvider(provider)) {
      throw new Error("Invalid mock OAuth provider");
    }

    await exchangeCode(provider, code, pending?.userId ?? null, {
      redirectUri: getUnifiedOAuthRedirectUri(),
      codeVerifier: pending?.codeVerifier,
      shopDomain: pending?.shopDomain,
    });

    const returnTo = pending?.returnTo ?? "web";
    delete req.session.oauthPending;
    return { redirectUrl: successRedirect(provider, returnTo), provider };
  }

  let provider: OAuthProviderId;
  let decoded: EncodedOAuthState;

  try {
    decoded = decodeOAuthState(stateRaw);
    provider = decoded.p;
  } catch {
    const pending = resolvePendingSession(req);
    if (!pending) throw new Error("OAuth session expired — start connect again");
    provider = pending.provider;
    decoded = { p: pending.provider, n: pending.nonce, u: pending.userId };
  }

  const pending = resolvePendingSession(req);
  if (!pending || pending.provider !== provider) {
    throw new Error("OAuth session expired — start connect again");
  }

  if (stateRaw !== pending.state) {
    throw new Error("Invalid OAuth state (CSRF)");
  }

  if (provider === "shopify") {
    validateShopifyCallbackHmac(req);
  }

  if (!code) throw new Error("Missing authorization code");

  const tokens = await exchangeCode(provider, code, pending.userId, {
    redirectUri: getUnifiedOAuthRedirectUri(),
    codeVerifier: pending.codeVerifier,
    shopDomain: pending.shopDomain,
  });

  if (!isMockOAuthMode()) {
    await saveConnectionTokens(provider, tokens, pending.userId);
  }
  delete req.session.oauthPending;

  const redirectUrl = successRedirect(provider, pending.returnTo);
  return { redirectUrl, provider };
}

export async function handleLegacyCallback(
  provider: OAuthProviderId,
  req: Request
): Promise<{ redirectUrl: string }> {
  const pending = resolvePendingSession(req);
  if (!pending || pending.provider !== provider) {
    throw new Error("OAuth session expired — start connect again");
  }

  const error = typeof req.query.error === "string" ? req.query.error : null;
  if (error) throw new Error(error);

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code) throw new Error("Missing authorization code");
  if (state !== pending.state) throw new Error("Invalid OAuth state");

  const tokens = await exchangeCode(provider, code, pending.userId, {
    redirectUri: getLegacyOAuthRedirectUri(provider),
    codeVerifier: pending.codeVerifier,
    shopDomain: pending.shopDomain,
  });

  if (!isMockOAuthMode()) {
    await saveConnectionTokens(provider, tokens, pending.userId);
  }
  delete req.session.oauthPending;

  return { redirectUrl: successRedirect(provider, pending.returnTo) };
}

function successRedirect(provider: OAuthProviderId, returnTo: "web" | "mobile"): string {
  if (returnTo === "mobile") {
    return `kauf26://oauth/${provider}?connected=1`;
  }
  return `${webAppUrl()}/settings?connected=true&marketplace=${provider}`;
}

export function oauthFailureRedirect(
  provider: string,
  message: string,
  returnTo: "web" | "mobile" = "web"
): string {
  if (returnTo === "mobile") {
    return `kauf26://oauth/${provider}?connected=0&reason=${encodeURIComponent(message)}`;
  }
  return `${webAppUrl()}/settings?connected=false&marketplace=${provider}&reason=${encodeURIComponent(message)}`;
}

export async function getValidAccessToken(
  userId: number | null,
  provider: string
): Promise<string | null> {
  if (!isUniversalOAuthProvider(provider)) return null;

  if (isMockOAuthMode()) {
    return getMockAccessToken(userId, provider);
  }

  const stored = await loadConnectionTokens(provider, userId);
  if (!stored?.accessToken) return null;

  const expiresAt = stored.expiresAt ? Date.parse(stored.expiresAt) : 0;
  const stillValid = !expiresAt || expiresAt > Date.now() + REFRESH_BUFFER_MS;
  if (stillValid) return stored.accessToken;

  if (!stored.refreshToken) {
    console.warn(`[OAuth] Token expired without refresh token provider=${provider}`);
    return null;
  }

  const lockKey = refreshLockKey(userId, provider);
  return withTokenRefreshLock(lockKey, async () => {
    const latest = await loadConnectionTokens(provider, userId);
    if (latest?.accessToken) {
      const latestExpiry = latest.expiresAt ? Date.parse(latest.expiresAt) : 0;
      if (!latestExpiry || latestExpiry > Date.now() + TOKEN_SKEW_MS) {
        return latest.accessToken;
      }
    }

    if (!latest?.refreshToken) return null;

    try {
      const refreshed = await refreshToken(provider, latest.refreshToken, {
        shopDomain: latest.shopDomain,
        userId,
      });
      await saveConnectionTokens(
        provider,
        { ...latest, ...refreshed } as StoredConnectionTokens,
        userId
      );
      return refreshed.accessToken;
    } catch (error) {
      console.error(`[OAuth] Refresh failed provider=${provider}:`, error);
      return null;
    }
  });
}

export async function listProviderConnectionStatus(userId: number | null) {
  const rows = isMockOAuthMode()
    ? listMockConnected(userId).map((provider) => ({
        provider,
        shopDomain: provider === "shopify" ? "mock-store.myshopify.com" : null,
        accountLabel: `Mock ${provider}`,
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        connected: true,
      }))
    : await import("./oauthConnectionStorage").then((m) => m.listConnections(userId));

  return UNIVERSAL_OAUTH_PROVIDERS.map((id) => {
    const row = rows.find((r) => r.provider === id);
    return {
      marketplace: id,
      provider: id,
      configured: isProviderConfigured(id),
      connected: Boolean(row),
      accountLabel: row?.accountLabel ?? null,
      shopDomain: row?.shopDomain ?? null,
      expiresAt: row?.tokenExpiresAt?.toString?.() ?? null,
    };
  });
}

// Legacy aliases
export type OAuthMarketplaceId = OAuthProviderId;
export const isOAuthMarketplace = isUniversalOAuthProvider;
export function buildAuthorizeUrl(
  provider: OAuthProviderId,
  req: Request,
  options: OAuthConnectOptions = {}
): string {
  return getAuthUrl(provider, resolveOAuthUserId(req), req, options);
}
export const disconnectMarketplace = revokeAccess;
export const handleOAuthCallback = handleLegacyCallback;
