import type { Express } from "express";
import { getUserById } from "./authStorage";
import { registerDevLoginRoutes } from "./devLogin";
import { isAuthenticated } from "./setupAuth";
import type { SessionUser } from "./types";

export function registerAuthRoutes(app: Express): void {
  registerDevLoginRoutes(app);

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser;
      const user = await getUserById(sessionUser.id);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      res.json({
        id: user.id,
        sub: user.sub,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        oauthProvider: user.oauthProvider,
        onboardingCompleted: user.onboardingCompleted,
        isNew: sessionUser.isNew,
        needsOnboarding: !user.onboardingCompleted,
      });
    } catch (error) {
      console.error("[auth] /api/auth/user", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
