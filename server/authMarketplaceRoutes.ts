/**
 * Universal marketplace OAuth API routes.
 * Mounted after session middleware (see setupAuth / index.ts).
 *
 * Marketplace tokens are never persisted — mobile stores in SecureStore;
 * web may hold tokens in session only for the current login.
 */
import express from "express";
import {
  getAuthUrl,
  getValidAccessToken,
  handleUnifiedCallback,
  isOAuthProviderConfigured,
  isUniversalOAuthProvider,
  listProviderConnectionStatus,
  oauthFailureRedirect,
  resolveOAuthUserId,
  revokeAccess,
  UNIVERSAL_OAUTH_PROVIDERS,
  type OAuthProviderId,
} from "./services/oauthService";
import { isMockOAuthMode } from "./services/oauth/mockOAuth";
import {
  classifyOAuthCallbackError,
  logOAuthCallbackError,
} from "./services/oauth/callbackErrors";
import { RESERVED_AUTH_PATHS } from "./services/oauth/types";
import { requireAuthInProduction } from "./auth/requireAuth";
import { getOAuthManifestEntry } from "../shared/marketplaceOAuthManifest";
import { getOAuthRedirectUri } from "../shared/oauthRedirect";
import {
  exchangeMarketplaceAuthorizationCode,
  isOAuthExchangeSupported,
} from "./services/marketplaceTokenExchange";
import type { TokenResponse } from "./services/oauth/types";

function wantsJsonOAuthResponse(req: express.Request): boolean {
  if (req.query.format === "json") return true;
  const accept = String(req.headers.accept ?? "");
  return accept.includes("application/json");
}

function respondOAuthCallbackError(
  req: express.Request,
  res: express.Response,
  provider: string,
  returnTo: "web" | "mobile",
  error: unknown
): express.Response {
  const info = classifyOAuthCallbackError(error);
  logOAuthCallbackError("unified callback", error, info);
  const details = info.message;

  if (wantsJsonOAuthResponse(req)) {
    return res.status(info.status).json({
      ok: false,
      error: "OAuth failed",
      details,
      kind: info.kind,
      provider,
      mockMode: isMockOAuthMode(),
    });
  }

  if (returnTo === "mobile") {
    return res.redirect(oauthFailureRedirect(provider, details, returnTo));
  }

  return res.status(info.status).json({
    error: "OAuth failed",
    details,
    kind: info.kind,
    provider,
    mockMode: isMockOAuthMode(),
  });
}

/** OAuth token JSON for mobile clients (never persisted server-side). */
function tokenResponseToOAuthJson(tokens: TokenResponse): Record<string, unknown> {
  const expiresIn = tokens.expiresAt
    ? Math.max(1, Math.floor((Date.parse(tokens.expiresAt) - Date.now()) / 1000))
    : 3600;
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: tokens.tokenType ?? "Bearer",
    expires_in: expiresIn,
    scope: tokens.scope,
    user_id: tokens.marketplaceShopId,
  };
}

const router = express.Router();

function parseProvider(param: string): OAuthProviderId | null {
  const id = param.toLowerCase();
  if (RESERVED_AUTH_PATHS.has(id)) return null;
  return isUniversalOAuthProvider(id) ? id : null;
}

function parseExchangeMarketplace(param: string): string | null {
  const id = param.toLowerCase();
  if (RESERVED_AUTH_PATHS.has(id)) return null;
  return isOAuthExchangeSupported(id) ? id : null;
}

function parseRevokeMarketplace(param: string): string | null {
  const id = param.toLowerCase();
  if (RESERVED_AUTH_PATHS.has(id)) return null;
  if (isUniversalOAuthProvider(id)) return id;
  return isOAuthExchangeSupported(id) ? id : null;
}

router.get("/connections", async (req, res) => {
  try {
    const userId = resolveOAuthUserId(req);
    const connections = listProviderConnectionStatus(req, userId);
    return res.status(200).json({
      connections,
      mockMode: isMockOAuthMode(),
      note: "Server does not store marketplace tokens. Mobile uses SecureStore; web uses session only.",
    });
  } catch (error) {
    console.error("[OAuth] connections error:", error);
    return res.status(500).json({ error: "Failed to load connections" });
  }
});

router.get("/callback", async (req, res) => {
  let returnTo: "web" | "mobile" = "web";
  let provider: string = "unknown";

  try {
    returnTo =
      req.session.oauthPending?.returnTo === "mobile" ? "mobile" : "web";
    provider =
      req.session.oauthPending?.provider ??
      (() => {
        try {
          const state = typeof req.query.state === "string" ? req.query.state : "";
          if (!state) return "unknown";
          const decoded = JSON.parse(
            Buffer.from(state, "base64url").toString("utf8")
          ) as { p?: OAuthProviderId };
          return decoded.p ?? "unknown";
        } catch {
          const code = typeof req.query.code === "string" ? req.query.code : "";
          if (code.startsWith("mock_")) return code.slice("mock_".length);
          return "unknown";
        }
      })();

    const { redirectUrl } = await handleUnifiedCallback(req);
    if (wantsJsonOAuthResponse(req)) {
      return res.status(200).json({
        ok: true,
        redirectUrl,
        provider,
        mockMode: isMockOAuthMode(),
      });
    }
    return res.redirect(redirectUrl);
  } catch (error) {
    return respondOAuthCallbackError(req, res, provider, returnTo, error);
  }
});

router.get("/:provider/url", (req, res) => {
  const provider = parseProvider(String(req.params.provider));
  if (!provider) {
    return res.status(400).json({ error: "Unsupported OAuth provider" });
  }

  try {
    const returnTo = req.query.returnTo === "mobile" ? "mobile" : "web";
    const shopDomain =
      typeof req.query.shop === "string"
        ? req.query.shop
        : typeof req.query.shopDomain === "string"
          ? req.query.shopDomain
          : undefined;

    const url = getAuthUrl(provider, resolveOAuthUserId(req), req, {
      shopDomain,
      returnTo,
    });

    if (req.query.redirect === "1" || req.query.redirect === "true") {
      return res.redirect(url);
    }

    return res.status(200).json({ url, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth start failed";
    const returnTo = req.query.returnTo === "mobile" ? "mobile" : "web";
    if (req.query.redirect === "1" || req.query.redirect === "true") {
      return res.redirect(oauthFailureRedirect(provider, message, returnTo));
    }
    return res.status(400).json({ error: message });
  }
});

/** Stateless token exchange — returns OAuth JSON, never persists tokens. */
router.post("/:marketplace/token-proxy", requireAuthInProduction, async (req, res) => {
  const marketplace = parseExchangeMarketplace(String(req.params.marketplace));
  if (!marketplace) {
    return res.status(400).json({ error: "Unsupported OAuth marketplace" });
  }

  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "code is required" });
  }

  const canonicalRedirect = getOAuthRedirectUri(marketplace);
  const redirectUri =
    typeof req.body?.redirectUri === "string" && req.body.redirectUri.trim()
      ? req.body.redirectUri.trim()
      : canonicalRedirect;

  const userId = resolveOAuthUserId(req);
  if (process.env.NODE_ENV === "production" && userId == null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const tokens = await exchangeMarketplaceAuthorizationCode(marketplace, code, {
      redirectUri,
      codeVerifier:
        typeof req.body?.codeVerifier === "string" ? req.body.codeVerifier : undefined,
      shopDomain:
        typeof req.body?.shopDomain === "string" ? req.body.shopDomain : undefined,
      siteUrl: typeof req.body?.siteUrl === "string" ? req.body.siteUrl : undefined,
      baseUrl: typeof req.body?.baseUrl === "string" ? req.body.baseUrl : undefined,
      userId,
    });

    return res.status(200).json(tokenResponseToOAuthJson(tokens));
  } catch (error) {
    const details = error instanceof Error ? error.message : "Token exchange failed";
    console.error(`[OAuth] POST /api/auth/${marketplace}/token-proxy failed:`, error);
    return res.status(400).json({ error: "OAuth exchange failed", details });
  }
});

/** @deprecated Use token-proxy — exchange no longer persists tokens. */
router.post("/:marketplace/exchange", requireAuthInProduction, async (req, res) => {
  const marketplace = parseExchangeMarketplace(String(req.params.marketplace));
  if (!marketplace) {
    return res.status(400).json({ error: "Unsupported OAuth marketplace" });
  }

  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "code is required" });
  }

  const canonicalRedirect = getOAuthRedirectUri(marketplace);
  const redirectUri =
    typeof req.body?.redirectUri === "string" && req.body.redirectUri.trim()
      ? req.body.redirectUri.trim()
      : canonicalRedirect;

  const userId = resolveOAuthUserId(req);
  if (process.env.NODE_ENV === "production" && userId == null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const tokens = await exchangeMarketplaceAuthorizationCode(marketplace, code, {
      redirectUri,
      codeVerifier:
        typeof req.body?.codeVerifier === "string" ? req.body.codeVerifier : undefined,
      shopDomain:
        typeof req.body?.shopDomain === "string" ? req.body.shopDomain : undefined,
      siteUrl: typeof req.body?.siteUrl === "string" ? req.body.siteUrl : undefined,
      baseUrl: typeof req.body?.baseUrl === "string" ? req.body.baseUrl : undefined,
      userId,
    });

    const entry = getOAuthManifestEntry(marketplace);
    return res.status(200).json({
      ok: true,
      provider: marketplace,
      marketplace,
      name: entry?.name ?? marketplace,
      accountLabel: tokens.accountLabel ?? null,
      shopDomain: tokens.shopDomain ?? null,
      ...tokenResponseToOAuthJson(tokens),
      deprecated: true,
      message:
        "This endpoint no longer stores tokens. Use POST /api/auth/:marketplace/token-proxy and save tokens on the device.",
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Token exchange failed";
    console.error(`[OAuth] POST /api/auth/${marketplace}/exchange failed:`, error);
    return res.status(400).json({ error: "OAuth exchange failed", details });
  }
});

router.post("/:provider/revoke", async (req, res) => {
  const provider = parseRevokeMarketplace(String(req.params.provider));
  if (!provider) {
    return res.status(400).json({ error: "Unsupported OAuth provider" });
  }

  try {
    if (isUniversalOAuthProvider(provider)) {
      await revokeAccess(provider, resolveOAuthUserId(req), req);
    }
    return res.status(200).json({ ok: true, provider });
  } catch (error) {
    console.error(`[OAuth] revoke ${provider} failed:`, error);
    return res.status(500).json({ error: "Failed to revoke access" });
  }
});

router.get("/:provider/status", async (req, res) => {
  const provider = parseRevokeMarketplace(String(req.params.provider));
  if (!provider) {
    return res.status(400).json({ error: "Unsupported OAuth provider" });
  }

  const userId = resolveOAuthUserId(req);
  const token = isUniversalOAuthProvider(provider)
    ? await getValidAccessToken(userId, provider, req)
    : null;
  const connections = listProviderConnectionStatus(req, userId);
  const row = connections.find((c) => c.provider === provider || c.marketplace === provider);

  const configured = isUniversalOAuthProvider(provider)
    ? isOAuthProviderConfigured(provider)
    : Boolean(getOAuthManifestEntry(provider)?.oauthSupported);

  return res.status(200).json({
    provider,
    configured,
    connected: Boolean(token),
    accountLabel: row?.accountLabel ?? null,
    shopDomain: row?.shopDomain ?? null,
    mockMode: isMockOAuthMode(),
    message: token
      ? "Connected"
      : configured
        ? "Not connected"
        : "OAuth not configured on server",
  });
});

export function registerMarketplaceAuthRoutes(app: express.Express): void {
  app.use("/api/auth", router);
}

export { UNIVERSAL_OAUTH_PROVIDERS };
export { router as marketplaceAuthRouter };
