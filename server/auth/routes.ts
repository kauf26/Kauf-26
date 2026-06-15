import type { Express, Request, Response } from "express";
import { getUserById, updateUserProfile, deleteAccountByUserId } from "./authStorage";
import { registerDevLoginRoutes } from "./devLogin";
import { isAuthenticated } from "./setupAuth";
import type { SessionUser } from "./types";

function profileResponse(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName || user.username,
    profileImageUrl: user.profileImageUrl,
    onboardingCompleted: user.onboardingCompleted,
  };
}

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

  app.get("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user as SessionUser;
      const user = await getUserById(sessionUser.id);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      return res.json(profileResponse(user));
    } catch (error) {
      console.error("[auth] GET /api/user/profile", error);
      return res.status(500).json({ message: "Failed to load profile" });
    }
  });

  app.post("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user as SessionUser;
      const { name, email, firstName, lastName } = req.body ?? {};
      const updated = await updateUserProfile(sessionUser.id, {
        name: typeof name === "string" ? name : undefined,
        email: typeof email === "string" ? email : undefined,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
      });
      return res.json(profileResponse(updated));
    } catch (error) {
      console.error("[auth] POST /api/user/profile", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update profile",
      });
    }
  });

  app.delete("/api/account", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user as SessionUser;
      await deleteAccountByUserId(sessionUser.id);

      req.logout(() => {
        req.session.destroy((err) => {
          if (err) {
            console.error("[auth] DELETE /api/account session destroy", err);
            return res.status(500).json({ message: "Account deleted but session cleanup failed" });
          }
          res.clearCookie("connect.sid");
          return res.status(200).json({ ok: true, message: "Account deleted" });
        });
      });
    } catch (error) {
      console.error("[auth] DELETE /api/account", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete account",
      });
    }
  });
}
