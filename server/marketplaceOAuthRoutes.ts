import express from "express";
import {
  buildAuthorizeUrl,
  disconnectMarketplace,
  getValidAccessToken,
  handleOAuthCallback,
  isOAuthMarketplace,
  oauthFailureRedirect,
  resolveOAuthUserId,
  type OAuthMarketplaceId,
} from "./services/marketplaceOAuthService";
import { listMarketplaceConnections } from "./services/marketplaceAuthStorage";
import { getOAuthProviderById } from "./config/oauthConfig";

const router = express.Router();

router.get("/connections", async (req, res) => {
  try {
    const userId = resolveOAuthUserId(req);
    const rows = await listMarketplaceConnections(userId);
    const platforms: OAuthMarketplaceId[] = ["etsy", "ebay", "shopify"];
    const configured = platforms.map((id) => {
      const provider = getOAuthProviderById(id);
      const row = rows.find((r) => r.marketplace === id);
      return {
        marketplace: id,
        configured: provider?.configured === true,
        connected: Boolean(row),
        accountLabel: row?.accountLabel ?? null,
        shopDomain: row?.shopDomain ?? null,
        expiresAt: row?.expiresAt?.toString?.() ?? null,
      };
    });
    return res.status(200).json({ connections: configured });
  } catch (error) {
    console.error("[OAuth] connections error:", error);
    return res.status(500).json({ error: "Failed to load connections" });
  }
});

router.get("/:marketplace/authorize", (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isOAuthMarketplace(marketplace)) {
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
  if (!isOAuthMarketplace(marketplace)) {
    return res.status(400).send("Unsupported marketplace");
  }

  const returnTo =
    req.session.marketplaceOAuth?.returnTo === "mobile" ? "mobile" : "web";

  try {
    const { redirectUrl } = await handleOAuthCallback(marketplace, req);
    return res.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    console.error(`[OAuth] ${marketplace} callback failed:`, message);
    return res.redirect(oauthFailureRedirect(marketplace, message, returnTo));
  }
});

router.delete("/:marketplace", async (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isOAuthMarketplace(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  try {
    await disconnectMarketplace(marketplace, resolveOAuthUserId(req));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(`[OAuth] disconnect ${marketplace} failed:`, error);
    return res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.get("/:marketplace/status", async (req, res) => {
  const marketplace = String(req.params.marketplace).toLowerCase();
  if (!isOAuthMarketplace(marketplace)) {
    return res.status(400).json({ error: "Unsupported marketplace" });
  }

  const provider = getOAuthProviderById(marketplace);
  const userId = resolveOAuthUserId(req);
  const token = await getValidAccessToken(marketplace, userId);
  const rows = await listMarketplaceConnections(userId);
  const row = rows.find((r) => r.marketplace === marketplace);

  return res.status(200).json({
    marketplace,
    configured: provider?.configured === true,
    connected: Boolean(token),
    accountLabel: row?.accountLabel ?? null,
    shopDomain: row?.shopDomain ?? null,
    message: token
      ? "Connected"
      : provider?.configured
        ? "Not connected"
        : "OAuth not configured on server",
  });
});

export { router as marketplaceOAuthRoutes };
