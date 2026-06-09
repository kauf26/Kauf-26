/**
 * Etsy OAuth routes (authorization code + PKCE).
 *
 * GET /api/etsy/oauth/start    → sets CSRF state + PKCE verifier in the
 *                                session, redirects to Etsy's consent page
 * GET /api/etsy/oauth/callback → validates state, exchanges the code,
 *                                resolves shop identity, stores tokens
 *                                backend-side, redirects to /settings
 *
 * Tokens are never returned to the frontend — only a connected flag.
 * Mount AFTER setupAuth() so req.session is available.
 */
import express, { type Request, type Response } from "express";
import {
  buildEtsyAuthorizeUrl,
  exchangeEtsyCode,
  fetchEtsyIdentity,
  generateOAuthState,
  generatePkcePair,
  getEtsyClientId,
} from "./services/etsyOAuth";
import { saveMarketplaceTokens } from "./services/tokenStorage";

declare module "express-session" {
  interface SessionData {
    etsyOAuth?: { state: string; verifier: string };
  }
}

const router = express.Router();

router.get("/start", (req: Request, res: Response) => {
  if (!getEtsyClientId()) {
    return res.status(503).json({
      message:
        "Set ETSY_CLIENT_ID (your Etsy app keystring) in .env before connecting Etsy.",
    });
  }
  if (!req.session) {
    return res.status(500).json({
      message: "Session middleware unavailable — cannot start OAuth flow.",
    });
  }

  const state = generateOAuthState();
  const { verifier, challenge } = generatePkcePair();
  req.session.etsyOAuth = { state, verifier };

  return res.redirect(buildEtsyAuthorizeUrl({ state, codeChallenge: challenge }));
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError =
    typeof req.query.error === "string" ? req.query.error : "";

  const pending = req.session?.etsyOAuth;
  // One-shot: clear stored state regardless of outcome.
  if (req.session) req.session.etsyOAuth = undefined;

  if (oauthError) {
    return res.redirect(
      `/settings?connected=false&marketplace=etsy&reason=${encodeURIComponent(oauthError)}`
    );
  }
  if (!code) {
    return res.status(400).json({
      message: "Missing ?code= from Etsy. Start at GET /api/etsy/oauth/start",
    });
  }
  if (!pending || !state || state !== pending.state) {
    return res.status(403).json({
      message:
        "OAuth state mismatch (possible CSRF or expired session). Restart at /api/etsy/oauth/start",
    });
  }

  try {
    const tokens = await exchangeEtsyCode(code, pending.verifier);

    let shopId: string | undefined;
    try {
      const identity = await fetchEtsyIdentity(tokens.accessToken);
      shopId = identity.shopId;
    } catch (err) {
      console.warn("[EtsyOAuth] could not resolve shop identity:", err);
    }

    await saveMarketplaceTokens("etsy", { ...tokens, shopId });

    console.log(
      `[EtsyOAuth] Connected — user ${tokens.userId}${shopId ? `, shop ${shopId}` : ""}`
    );
    return res.redirect("/settings?connected=true&marketplace=etsy");
  } catch (error) {
    console.error("[EtsyOAuth] callback error:", error);
    return res.redirect(
      `/settings?connected=false&marketplace=etsy&reason=${encodeURIComponent(
        error instanceof Error ? error.message.slice(0, 120) : "token_exchange_failed"
      )}`
    );
  }
});

export default router;
