/**
 * Universal marketplace OAuth API routes.
 * Mounted after session middleware (see setupAuth / index.ts).
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
import { RESERVED_AUTH_PATHS } from "./services/oauth/types";

const router = express.Router();

function parseProvider(param: string): OAuthProviderId | null {
  const id = param.toLowerCase();
  if (RESERVED_AUTH_PATHS.has(id)) return null;
  return isUniversalOAuthProvider(id) ? id : null;
}

router.get("/connections", async (req, res) => {
  try {
    const userId = resolveOAuthUserId(req);
    const connections = await listProviderConnectionStatus(userId);
    return res.status(200).json({
      connections,
      mockMode: isMockOAuthMode(),
    });
  } catch (error) {
    console.error("[OAuth] connections error:", error);
    return res.status(500).json({ error: "Failed to load connections" });
  }
});

router.get("/callback", async (req, res) => {
  const returnTo =
    req.session.oauthPending?.returnTo === "mobile" ? "mobile" : "web";
  const provider =
    req.session.oauthPending?.provider ??
    (() => {
      try {
        const state = typeof req.query.state === "string" ? req.query.state : "";
        if (!state) return null;
        const decoded = JSON.parse(
          Buffer.from(state, "base64url").toString("utf8")
        ) as { p?: OAuthProviderId };
        return decoded.p ?? null;
      } catch {
        return null;
      }
    })();

  try {
    const { redirectUrl } = await handleUnifiedCallback(req);
    return res.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    console.error("[OAuth] unified callback failed:", message);
    return res.redirect(
      oauthFailureRedirect(provider ?? "unknown", message, returnTo)
    );
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

router.post("/:provider/revoke", async (req, res) => {
  const provider = parseProvider(String(req.params.provider));
  if (!provider) {
    return res.status(400).json({ error: "Unsupported OAuth provider" });
  }

  try {
    await revokeAccess(provider, resolveOAuthUserId(req));
    return res.status(200).json({ ok: true, provider });
  } catch (error) {
    console.error(`[OAuth] revoke ${provider} failed:`, error);
    return res.status(500).json({ error: "Failed to revoke access" });
  }
});

router.get("/:provider/status", async (req, res) => {
  const provider = parseProvider(String(req.params.provider));
  if (!provider) {
    return res.status(400).json({ error: "Unsupported OAuth provider" });
  }

  const userId = resolveOAuthUserId(req);
  const token = await getValidAccessToken(userId, provider);
  const connections = await listProviderConnectionStatus(userId);
  const row = connections.find((c) => c.provider === provider);

  return res.status(200).json({
    provider,
    configured: isOAuthProviderConfigured(provider),
    connected: Boolean(token),
    accountLabel: row?.accountLabel ?? null,
    shopDomain: row?.shopDomain ?? null,
    mockMode: isMockOAuthMode(),
    message: token
      ? "Connected"
      : isOAuthProviderConfigured(provider)
        ? "Not connected"
        : "OAuth not configured on server",
  });
});

export function registerMarketplaceAuthRoutes(app: express.Express): void {
  app.use("/api/auth", router);
}

export { UNIVERSAL_OAUTH_PROVIDERS };
export { router as marketplaceAuthRouter };
