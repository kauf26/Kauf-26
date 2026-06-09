import express from "express";
import { getDepopAnalytics } from "./services/depopAnalytics";

const router = express.Router();

router.get("/depop", async (_req, res) => {
  try {
    const analytics = await getDepopAnalytics();
    return res.json(analytics);
  } catch (err) {
    console.error("[Analytics] Depop:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load Depop analytics",
    });
  }
});

export default router;
