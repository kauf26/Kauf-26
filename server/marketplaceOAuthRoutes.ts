import express from "express";
import {
  buildAuthorizeUrl,
  getValidAccessToken,
  handleLegacyCallback,
  isUniversalOAuthProvider,
  oauthFailureRedirect,
  resolveOAuthUserId,
  revokeAccess,
  listProviderConnectionStatus,
  type OAuthProviderId,
} from "./services/oauthService";
import {
  classifyOAuthCallbackError,
  logOAuthCallbackError,
} from "./services/oauth/callbackErrors";

const router = express.Router();

/** Legacy /api/oauth/* routes — prefer /api/auth/:provider/url */
router.get("/connections", async (req, res) => {
  try {
    const userId = resolveOAuthUserId(req);
    const connections = await listProviderConnectionStatus(userId);
    return res.status(200).json({ connections });
  } catch (error) {
    console.error("[OAuth] connections error:", error);
    return res.status(500).json({ error: "Failed to load connections" });
  }
});

router.get("/:marketplace/authorize", (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isUniversalOAuthProvider(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  try {
    const returnTo = req.query.returnTo === "mobile" ? "mobile" : "web";
    const shopDomain =
      typeof req.query.shop === "string"
        ? req.query.shop
        : typeof req.query.shopDomain === "string"
          ? req.query.shopDomain
          : undefined;

    const url = buildAuthorizeUrl(marketplace, req, { shopDomain, returnTo });
    return res.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth start failed";
    const returnTo = req.query.returnTo === "mobile" ? "mobile" : "web";
    return res.redirect(oauthFailureRedirect(marketplace, message, returnTo));
  }
});

router.get("/:marketplace/callback", async (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isUniversalOAuthProvider(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  const returnTo =
    req.session.oauthPending?.returnTo === "mobile" ? "mobile" : "web";

  try {
    const { redirectUrl } = await handleLegacyCallback(marketplace, req);
    return res.redirect(redirectUrl);
  } catch (error) {
    const info = classifyOAuthCallbackError(error);
    logOAuthCallbackError(`${marketplace} callback`, error, info);
    if (returnTo === "mobile") {
      return res.redirect(oauthFailureRedirect(marketplace, info.message, returnTo));
    }
    return res.status(info.status).json({
      error: "OAuth failed",
      details: info.message,
      kind: info.kind,
      provider: marketplace,
    });
  }
});

router.delete("/:marketplace", async (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isUniversalOAuthProvider(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  try {
    await revokeAccess(marketplace, resolveOAuthUserId(req));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(`[OAuth] disconnect ${marketplace} failed:`, error);
    return res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.get("/:marketplace/status", async (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase() as OAuthProviderId;
  if (!isUniversalOAuthProvider(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  const userId = resolveOAuthUserId(req);
  const token = await getValidAccessToken(userId, marketplace);
  const connections = await listProviderConnectionStatus(userId);
  const row = connections.find((c) => c.provider === marketplace);

  return res.status(200).json({
    marketplace,
    configured: row?.configured ?? false,
    connected: Boolean(token),
    accountLabel: row?.accountLabel ?? null,
    shopDomain: row?.shopDomain ?? null,
    message: token ? "Connected" : row?.configured ? "Not connected" : "OAuth not configured",
  });
});

export { router as marketplaceOAuthRoutes };
