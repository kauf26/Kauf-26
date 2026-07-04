import { timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler } from "express";
import {
  DEMO_ACCOUNT_EMAIL,
  DEMO_ACCOUNT_PASSWORD,
  DEMO_ACCOUNT_USER_SUB,
  isDemoAccountEnabled,
} from "../../shared/demoAccount";
import { completeOnboarding, upsertOAuthUser } from "./authStorage";
import type { SessionUser } from "./types";

const demoLoginGuard: RequestHandler = (_req, res, next) => {
  if (!isDemoAccountEnabled()) {
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

export function registerDemoLoginRoutes(app: Express): void {
  app.get("/api/auth/demo-login/enabled", (_req, res) => {
    res.json({ enabled: isDemoAccountEnabled() });
  });

  app.post("/api/auth/demo-login", demoLoginGuard, async (req, res, next) => {
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "").trim();

    if (
      !safeEqual(email, DEMO_ACCOUNT_EMAIL) ||
      !safeEqual(password, DEMO_ACCOUNT_PASSWORD)
    ) {
      return res.status(401).json({ message: "Invalid demo credentials" });
    }

    try {
      const { user } = await upsertOAuthUser({
        sub: DEMO_ACCOUNT_USER_SUB,
        email: DEMO_ACCOUNT_EMAIL,
        firstName: "Demo",
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
            needsOnboarding: false,
          },
        });
      });
    } catch (error) {
      console.error("[auth] demo-login", error);
      return res.status(500).json({ message: "Demo login failed" });
    }
  });

  if (isDemoAccountEnabled()) {
    console.warn(
      "[auth] Demo account login enabled (development only). Disabled automatically in production."
    );
  }
}
