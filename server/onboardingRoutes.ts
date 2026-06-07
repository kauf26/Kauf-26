import { Router } from "express";
import { z } from "zod";
import { BROWSER_AUTH_MARKETPLACES } from "./config/browserAuthMarketplaces";
import { isAuthenticated } from "./auth";
import { completeOnboarding } from "./auth/authStorage";
import type { SessionUser } from "./auth/types";
import { getUserById } from "./auth/authStorage";
import { SessionStorageService } from "./services/browserAuth/SessionStorageService";

const router = Router();

const connectSchema = z.object({
  marketplaceId: z.string().min(1),
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1),
});

router.use(isAuthenticated);

router.get("/status", async (req, res) => {
  const sessionUser = req.user as SessionUser;
  const dbUser = await getUserById(sessionUser.id);
  const storage = new SessionStorageService();
  const connected = await storage.listMarketplaceIds(sessionUser.id);

  res.json({
    needsWizard: dbUser ? !dbUser.onboardingCompleted : sessionUser.needsOnboarding,
    onboardingCompleted: dbUser?.onboardingCompleted ?? false,
    connectedMarketplaces: connected,
    availableMarketplaces: BROWSER_AUTH_MARKETPLACES.map((m) => ({
      id: m.id,
      name: m.name,
    })),
  });
});

router.post("/connect", async (req, res) => {
  const user = req.user as SessionUser;
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { marketplaceId, email, username, password } = parsed.data;
  if (!email && !username) {
    return res.status(400).json({ error: "email or username required" });
  }

  const config = BROWSER_AUTH_MARKETPLACES.find((m) => m.id === marketplaceId);
  if (!config) {
    return res.status(400).json({ error: `Unsupported marketplace: ${marketplaceId}` });
  }

  try {
    const { createAuthenticationService, registerMarketplaceStrategy } =
      await import("./services/browserAuth/browserAuthFactory");
    const auth = createAuthenticationService(user.id);
    registerMarketplaceStrategy(auth, marketplaceId, {
      email,
      username,
      password,
    });

    const result = await auth.authenticateWithSession(marketplaceId, {
      userId: user.id,
      headless: process.env.BROWSER_AUTH_HEADLESS !== "false",
    });

    res.json({
      ok: result.success,
      marketplaceId,
      reusedSession: result.reusedSession ?? false,
      message: result.message,
    });
  } catch (err) {
    console.error("[onboarding] connect", marketplaceId, err);
    const message = err instanceof Error ? err.message : "Marketplace login failed";
    if (message.includes("Cannot find package 'playwright'")) {
      return res.status(503).json({
        error: "Playwright is not installed. Run: npx playwright install chromium",
      });
    }
    return res.status(500).json({ error: message });
  }
});

router.post("/complete", async (req, res) => {
  const user = req.user as SessionUser;
  try {
    const updated = await completeOnboarding(user.id);
    if (req.user) {
      (req.user as SessionUser).needsOnboarding = false;
      (req.user as SessionUser).isNew = false;
    }
    res.json({ onboardingCompleted: updated.onboardingCompleted });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to complete onboarding",
    });
  }
});

router.post("/restore-sessions", async (req, res) => {
  const user = req.user as SessionUser;
  const storage = new SessionStorageService();
  const marketplaceIds = await storage.listMarketplaceIds(user.id);

  if (marketplaceIds.length === 0) {
    return res.json({ restored: [], message: "No stored sessions" });
  }

  try {
    const { createAuthenticationService, registerVerifyOnlyStrategy } =
      await import("./services/browserAuth/browserAuthFactory");
    const auth = createAuthenticationService(user.id);
    for (const id of marketplaceIds) {
      registerVerifyOnlyStrategy(auth, id);
    }

    const results = await auth.restoreAllSessions(user.id, {
      userId: user.id,
      headless: process.env.BROWSER_AUTH_HEADLESS !== "false",
    });
    return res.json({ restored: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session restore failed";
    if (message.includes("Cannot find package 'playwright'")) {
      return res.status(503).json({
        error: "Playwright is not installed. Run: npx playwright install chromium",
      });
    }
    return res.status(500).json({ error: message });
  }
});

export default router;
