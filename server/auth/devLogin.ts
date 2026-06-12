import type { Express, RequestHandler } from "express";
import { DEV_LOGIN_PIN, isDevLoginEnabled } from "../../shared/devAuth";
import { completeOnboarding, upsertOAuthUser } from "./authStorage";
import type { SessionUser } from "./types";

export const DEV_MOCK_USER_SUB = "dev_mock_user";

const devLoginGuard: RequestHandler = (_req, res, next) => {
  if (!isDevLoginEnabled()) {
    return res.status(404).json({ message: "Not found" });
  }
  return next();
};

export function registerDevLoginRoutes(app: Express): void {
  app.get("/api/auth/dev-login/enabled", (_req, res) => {
    res.json({ enabled: isDevLoginEnabled() });
  });

  app.post("/api/auth/dev-login", devLoginGuard, async (req, res, next) => {
    const pin = String(req.body?.pin ?? "").trim();
    if (pin !== DEV_LOGIN_PIN) {
      return res.status(401).json({ message: "Invalid PIN" });
    }

    try {
      const { user } = await upsertOAuthUser({
        sub: DEV_MOCK_USER_SUB,
        email: "dev@localhost",
        firstName: "Dev",
        lastName: "User",
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
      console.error("[auth] dev-login", error);
      return res.status(500).json({ message: "Dev login failed" });
    }
  });

  if (isDevLoginEnabled()) {
    console.warn(
      "[auth] Dev PIN login enabled (MOCK_OAUTH_MODE=true, NODE_ENV≠production). PIN is fixed — never enable in production."
    );
  }
}
