import type { Express } from "express";
import { authStorage } from "./replit_integrations/auth/storage";
import { registerCatalogRoutes } from "./catalogRoutes";

export function registerRoutes(app: Express) {
  registerCatalogRoutes(app);

  app.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const sub = (req.user as { claims?: { sub?: string } })?.claims?.sub;
      if (!sub) {
        return res.status(400).json({ message: "Missing user id" });
      }
      await authStorage.deleteUser(sub);
      req.logout((err) => {
        if (err) return res.status(500).send("Error logging out");
        res.sendStatus(200);
      });
    } catch {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  return app;
}

export function calcTrialStatus(firstLoginAt: Date) {
 const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
 const elapsed = Date.now() - firstLoginAt.getTime();
 const isTrialActive = elapsed < TRIAL_DURATION_MS;
 const trialDaysRemaining = Math.max(0, Math.ceil((TRIAL_DURATION_MS - elapsed) / (24 * 60 * 60 * 1000)));
 const trialEndsAt = new Date(firstLoginAt.getTime() + TRIAL_DURATION_MS);
 return { isTrialActive, trialDaysRemaining, trialEndsAt };
}
