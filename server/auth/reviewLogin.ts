import { timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler } from "express";
import {
  getReviewDemoCredentials,
  isReviewDemoEnabled,
} from "../../shared/reviewDemo";
import { completeOnboarding, upsertOAuthUser } from "./authStorage";
import type { SessionUser } from "./types";

export const REVIEW_DEMO_USER_SUB = "review_demo_user";

const reviewLoginGuard: RequestHandler = (_req, res, next) => {
  if (!isReviewDemoEnabled()) {
    return res.status(404).json({ message: "Not found" });
  }
  return next();
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function registerReviewLoginRoutes(app: Express): void {
  app.get("/api/auth/review-login/enabled", (_req, res) => {
    res.json({ enabled: isReviewDemoEnabled() });
  });

  app.post("/api/auth/review-login", reviewLoginGuard, async (req, res, next) => {
    const creds = getReviewDemoCredentials();
    if (!creds) {
      return res.status(404).json({ message: "Not found" });
    }

    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    if (!safeEqual(email, creds.email) || !safeEqual(password, creds.password)) {
      return res.status(401).json({ message: "Invalid review credentials" });
    }

    try {
      const { user } = await upsertOAuthUser({
        sub: REVIEW_DEMO_USER_SUB,
        email: creds.email,
        firstName: "App",
        lastName: "Reviewer",
        provider: "google",
      });

      const onboarded =
        user.onboardingCompleted ? user : await completeOnboarding(user.id);

      const sessionUser: SessionUser = {
        id: onboarded.id,
        sub: onboarded.sub,
        email: onboarded.email,
        provider: "google",
        isNew: false,
        needsOnboarding: false,
      };

      req.login(sessionUser, (err) => {
        if (err) return next(err);
        return res.status(200).json({
          ok: true,
          user: {
            id: sessionUser.id,
            email: sessionUser.email,
            needsOnboarding: sessionUser.needsOnboarding,
          },
        });
      });
    } catch (error) {
      console.error("[auth] review-login", error);
      return res.status(500).json({ message: "Review login failed" });
    }
  });

  if (isReviewDemoEnabled()) {
    console.warn(
      "[auth] App Review demo login is ENABLED (APP_REVIEW_DEMO_ENABLED=true). Disable after App Store approval."
    );
  }
}
