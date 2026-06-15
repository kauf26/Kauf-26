import type { Express, Request, Response, NextFunction } from "express";
import { upsertOAuthUser } from "./authStorage";
import { verifyAppleIdentityToken } from "./appleTokenVerify";
import type { SessionUser } from "./types";

function toSessionUser(
  user: Awaited<ReturnType<typeof upsertOAuthUser>>["user"],
  provider: SessionUser["provider"],
  isNew: boolean
): SessionUser {
  return {
    id: user.id,
    sub: user.sub,
    email: user.email,
    provider,
    isNew,
    needsOnboarding: isNew || !user.onboardingCompleted,
  };
}

function loginSessionUser(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionUser: SessionUser
): void {
  req.login(sessionUser, (err) => {
    if (err) return next(err);
    return res.status(200).json({
      ok: true,
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        provider: sessionUser.provider,
        needsOnboarding: sessionUser.needsOnboarding,
      },
    });
  });
}

export function registerMobileAuthRoutes(app: Express): void {
  /** Native Sign in with Apple — identity token verified server-side; no marketplace tokens stored. */
  app.post("/api/auth/mobile/apple", async (req, res, next) => {
    const identityToken =
      typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";
    if (!identityToken) {
      return res.status(400).json({ message: "identityToken is required" });
    }

    const clientId = process.env.APPLE_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(503).json({ message: "Apple Sign In is not configured on the server" });
    }

    try {
      const verified = await verifyAppleIdentityToken(identityToken, clientId);
      const fullName = req.body?.fullName as
        | { givenName?: string; familyName?: string }
        | undefined;

      const sub = `apple_${verified.sub}`;
      const { user, isNew } = await upsertOAuthUser({
        sub,
        email: verified.email,
        firstName: fullName?.givenName,
        lastName: fullName?.familyName,
        provider: "apple",
      });

      loginSessionUser(req, res, next, toSessionUser(user, "apple", isNew));
    } catch (error) {
      console.error("[auth] mobile/apple failed:", error);
      return res.status(401).json({
        message: error instanceof Error ? error.message : "Apple Sign In failed",
      });
    }
  });

  /** JSON logout for mobile clients (clears session cookie). */
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("connect.sid");
        return res.status(200).json({ ok: true });
      });
    });
  });
}

/** Redirect target after web OAuth when platform=mobile. */
export function mobileOAuthSuccessRedirect(provider: "google" | "apple"): string {
  return `kauf26://auth/${provider}?connected=1`;
}

export function mobileOAuthFailureRedirect(
  provider: "google" | "apple",
  reason: string
): string {
  return `kauf26://auth/${provider}?connected=0&reason=${encodeURIComponent(reason)}`;
}
