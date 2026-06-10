/**
 * User onboarding — profile completion only.
 * Marketplace OAuth runs on the mobile device; no passwords or platform tokens here.
 */
import { Router } from "express";
import { isAuthenticated } from "./auth";
import { completeOnboarding, getUserById } from "./auth/authStorage";
import type { SessionUser } from "./auth/types";

const router = Router();

router.use(isAuthenticated);

router.get("/status", async (req, res) => {
  const sessionUser = req.user as SessionUser;
  const dbUser = await getUserById(sessionUser.id);

  res.json({
    needsWizard: dbUser ? !dbUser.onboardingCompleted : sessionUser.needsOnboarding,
    onboardingCompleted: dbUser?.onboardingCompleted ?? false,
    connectedMarketplaces: [],
    availableMarketplaces: [
      { id: "etsy", name: "Etsy" },
      { id: "shopify", name: "Shopify" },
      { id: "ebay", name: "eBay" },
    ],
    message:
      "Connect Etsy, Shopify, and eBay in the mobile app with one-tap OAuth — tokens stay on your device.",
  });
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

export default router;
