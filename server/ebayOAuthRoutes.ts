/**
 * eBay OAuth routes — authorization code grant.
 * GET /api/ebay/oauth/start
 * GET /api/ebay/oauth/callback
 */
import express, { type Request, type Response } from "express";
import {
  buildEbayAuthorizeUrl,
  exchangeEbayCode,
  generateOAuthState,
  getEbayClientId,
  getEbayClientSecret,
} from "./services/ebayOAuth";
import { saveMarketplaceTokens } from "./services/tokenStorage";

declare module "express-session" {
  interface SessionData {
    ebayOAuth?: { state: string };
  }
}

const router = express.Router();

router.get("/start", (req: Request, res: Response) => {
  if (!getEbayClientId() || !getEbayClientSecret()) {
    return res.status(503).json({
      message:
        "Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env before connecting eBay.",
    });
  }
  if (!req.session) {
    return res.status(500).json({ message: "Session middleware unavailable." });
  }

  const state = generateOAuthState();
  req.session.ebayOAuth = { state };

  return res.redirect(buildEbayAuthorizeUrl(state));
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError =
    typeof req.query.error === "string" ? req.query.error : "";

  const pending = req.session?.ebayOAuth;
  if (req.session) req.session.ebayOAuth = undefined;

  if (oauthError) {
    return res.redirect(
      `/settings?connected=false&marketplace=ebay&reason=${encodeURIComponent(oauthError)}`
    );
  }
  if (!code) {
    return res.status(400).json({
      message: "Missing ?code= from eBay. Start at GET /api/ebay/oauth/start",
    });
  }
  if (!pending || !state || state !== pending.state) {
    return res.status(403).json({
      message: "OAuth state mismatch — restart at /api/ebay/oauth/start",
    });
  }

  try {
    const tokens = await exchangeEbayCode(code);
    await saveMarketplaceTokens("ebay", {
      ...tokens,
      accountName: "eBay seller account",
    });

    console.log("[EbayOAuth] Connected");
    return res.redirect("/settings?connected=true&marketplace=ebay");
  } catch (error) {
    console.error("[EbayOAuth] callback error:", error);
    return res.redirect(
      `/settings?connected=false&marketplace=ebay&reason=${encodeURIComponent(
        error instanceof Error ? error.message.slice(0, 120) : "token_exchange_failed"
      )}`
    );
  }
});

export default router;
