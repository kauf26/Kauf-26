/**
 * Marketplace eligibility API — rules from config/marketplace-rules.json.
 */
import express from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { productDrafts } from "../../shared/schema";
import { getEnabledMarketplaceIds } from "../config/marketplaces";
import {
  checkEligibilityForMarketplaces,
  eligibilityDraftFromDbRow,
  eligibilityDraftFromFields,
  reloadMarketplaceRules,
  type EligibilityDraft,
} from "../services/marketplaceEligibility";

const router = express.Router();

function parseDraftFromBody(body: Record<string, unknown>): EligibilityDraft {
  const attributes =
    body.attributes && typeof body.attributes === "object"
      ? (body.attributes as Record<string, unknown>)
      : undefined;

  return eligibilityDraftFromFields({
    title: typeof body.title === "string" ? body.title : undefined,
    description:
      typeof body.description === "string" ? body.description : undefined,
    price:
      typeof body.price === "string" ||
      typeof body.price === "number" ||
      body.price == null
        ? (body.price as string | number | null)
        : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    condition: typeof body.condition === "string" ? body.condition : undefined,
    brand: typeof body.brand === "string" ? body.brand : undefined,
    attributes,
  });
}

function resolveMarketplaceIds(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.marketplaceIds)) {
    return body.marketplaceIds.map((id) => String(id).toLowerCase());
  }
  if (Array.isArray(body.marketplaces)) {
    return body.marketplaces.map((id) => String(id).toLowerCase());
  }
  return getEnabledMarketplaceIds();
}

/** POST /api/marketplaces/check-eligibility */
router.post("/check-eligibility", (req, res) => {
  try {
    const draft = parseDraftFromBody(req.body ?? {});
    const marketplaceIds = resolveMarketplaceIds(req.body ?? {});
    const results = checkEligibilityForMarketplaces(draft, marketplaceIds);
    return res.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eligibility check failed";
    console.error("[Eligibility] check-eligibility error:", error);
    return res.status(500).json({ error: message });
  }
});

/** GET /api/marketplaces/eligibility?draftId=123 */
router.get("/eligibility", async (req, res) => {
  const draftId = Number(req.query.draftId);
  if (!Number.isFinite(draftId)) {
    return res.status(400).json({ error: "draftId query parameter is required" });
  }

  try {
    const [draft] = await db
      .select()
      .from(productDrafts)
      .where(eq(productDrafts.id, draftId));

    if (!draft) {
      return res.status(404).json({ error: `Draft ${draftId} not found` });
    }

    const eligibilityDraft = eligibilityDraftFromDbRow(draft);
    const marketplaceIds = resolveMarketplaceIds({
      marketplaceIds: req.query.marketplaceIds
        ? String(req.query.marketplaceIds).split(",")
        : getEnabledMarketplaceIds(),
    });
    const results = checkEligibilityForMarketplaces(
      eligibilityDraft,
      marketplaceIds
    );

    return res.json({
      draftId,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eligibility check failed";
    console.error("[Eligibility] GET eligibility error:", error);
    return res.status(500).json({ error: message });
  }
});

/** POST /api/marketplaces/eligibility/reload — reload rules without server restart */
router.post("/eligibility/reload", (req, res) => {
  if (process.env.NODE_ENV === "production" && req.query.force !== "1") {
    return res.status(403).json({
      error: "Rule reload is disabled in production (use ?force=1 to override)",
    });
  }

  try {
    const document = reloadMarketplaceRules();
    return res.json({
      ok: true,
      version: document.version,
      marketplaceCount: Object.keys(document.marketplaces).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reload rules";
    console.error("[Eligibility] reload error:", error);
    return res.status(500).json({ error: message });
  }
});

export default router;
