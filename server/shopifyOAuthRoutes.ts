/**
 * Shopify OAuth routes — authorization code grant.
 * GET /api/shopify/oauth/start?shop=your-store.myshopify.com
 * GET /api/shopify/oauth/callback
 */
import express, { type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import {
  buildShopifyAuthorizeUrl,
  exchangeShopifyCode,
  fetchShopifyShopName,
  getShopifyClientId,
  getShopifyClientSecret,
  normalizeShopifyDomain,
} from "./services/shopifyOAuth";
import { saveMarketplaceTokens } from "./services/tokenStorage";

declare module "express-session" {
  interface SessionData {
    shopifyOAuth?: { state: string; shopDomain: string };
  }
}

const router = express.Router();

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

router.get("/start", (req: Request, res: Response) => {
  if (!getShopifyClientId() || !getShopifyClientSecret()) {
    return res.status(503).json({
      message:
        "Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in .env before connecting Shopify.",
    });
  }
  if (!req.session) {
    return res.status(500).json({ message: "Session middleware unavailable." });
  }

  const shopRaw =
    typeof req.query.shop === "string" ? req.query.shop.trim() : "";
  if (!shopRaw) {
    return res.status(400).json({
      message:
        "Pass ?shop=your-store.myshopify.com (or your-store) to start Shopify OAuth.",
    });
  }

  let shopDomain: string;
  try {
    shopDomain = normalizeShopifyDomain(shopRaw);
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : "Invalid shop domain",
    });
  }

  const state = generateState();
  req.session.shopifyOAuth = { state, shopDomain };

  return res.redirect(buildShopifyAuthorizeUrl({ shopDomain, state }));
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError =
    typeof req.query.error === "string" ? req.query.error : "";

  const pending = req.session?.shopifyOAuth;
  if (req.session) req.session.shopifyOAuth = undefined;

  if (oauthError) {
    return res.redirect(
      `/settings?connected=false&marketplace=shopify&reason=${encodeURIComponent(oauthError)}`
    );
  }
  if (!code) {
    return res.status(400).json({
      message: "Missing ?code= from Shopify. Start at GET /api/shopify/oauth/start?shop=…",
    });
  }
  if (!pending || !state || state !== pending.state) {
    return res.status(403).json({
      message: "OAuth state mismatch — restart at /api/shopify/oauth/start",
    });
  }

  try {
    const tokens = await exchangeShopifyCode(pending.shopDomain, code);
    const shopName = await fetchShopifyShopName(
      tokens.shopDomain!,
      tokens.accessToken
    );
    await saveMarketplaceTokens("shopify", {
      ...tokens,
      accountName: shopName ?? tokens.shopDomain,
    });

    console.log(`[ShopifyOAuth] Connected — ${tokens.shopDomain}`);
    return res.redirect("/settings?connected=true&marketplace=shopify");
  } catch (error) {
    console.error("[ShopifyOAuth] callback error:", error);
    return res.redirect(
      `/settings?connected=false&marketplace=shopify&reason=${encodeURIComponent(
        error instanceof Error ? error.message.slice(0, 120) : "token_exchange_failed"
      )}`
    );
  }
});

export default router;
