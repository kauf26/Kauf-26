import express from 'express';
import { db } from './db';
import { productDrafts, publishJobs, publishTasks } from '../shared/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { collectDraftImages } from './services/adapters/adapterUtils';
import {
  MAX_DRAFT_IMAGES,
  mergeUniqueDraftImageUrls,
  validateAddPhotosRequest,
} from '../shared/draftImages';
import {
  draftPhotoUpload,
  ensureUploadsDir,
  filesToPublicUrls,
} from './services/draftPhotoUpload';
import { countUniqueProductDrafts } from '../shared/draftCount';
import {
  draftAccessWhere,
  draftVisibilityCondition,
  requireAuthInProduction,
  userIdForNewDraft,
} from './auth';

const router = express.Router();

router.use(requireAuthInProduction);

const STRIPPED_ATTRIBUTE_KEYS = [
  "productUrl",
  "url",
  "link",
  "externalUrl",
] as const;

function normalizeDraftAttributes(
  attributes: Record<string, unknown> | undefined
): Record<string, unknown> {
  const a = { ...(attributes ?? {}) };
  for (const key of STRIPPED_ATTRIBUTE_KEYS) {
    delete a[key];
  }

  const marketPrices =
    (a.marketPrices as Record<string, string> | undefined) ?? {};
  const recommended =
    marketPrices.recommendedPrice ??
    String(a.recommendedPrice ?? a.medianPrice ?? a.price ?? "0.00");

  return {
    ...a,
    brand: String(a.brand ?? "").trim(),
    model: String(a.model ?? "").trim(),
    priceReliable: a.priceReliable === true,
    isExactMatch: a.isExactMatch === true,
    matchType: String(a.matchType ?? "generic"),
    longDescription: String(a.longDescription ?? a.aiDescription ?? "").trim(),
    recommendedPrice: String(a.recommendedPrice ?? recommended),
    medianPrice: String(a.medianPrice ?? recommended),
    scraperMetadata:
      (a.scraperMetadata as Record<string, unknown> | undefined) ??
      (a._scraperMetadata as Record<string, unknown> | undefined) ??
      null,
    marketPrices: {
      allegroAvg: marketPrices.allegroAvg ?? String(a.allegroAvg ?? "0.00"),
      ebayAvg: marketPrices.ebayAvg ?? String(a.ebayAvg ?? "0.00"),
      recommendedPrice: recommended,
    },
  };
}

function resolveDraftImagesForSave(
  bodyImages: unknown,
  attributes: Record<string, unknown>,
  existingImages: string[] = []
): string[] {
  const merged = collectDraftImages({
    images: [
      ...existingImages,
      ...(Array.isArray(bodyImages) ? bodyImages : []),
    ],
    attributes,
  });
  return merged.slice(0, MAX_DRAFT_IMAGES);
}

function syncDraftImageAttributes(
  attributes: Record<string, unknown>,
  images: string[]
): Record<string, unknown> {
  return {
    ...attributes,
    capturedImage: images[0] ?? attributes.capturedImage ?? "",
    capturedImages: images,
  };
}

// --- 1. SAVE OR UPDATE A DRAFT (POST) ---
router.post("/drafts", async (req, res) => {
 console.log("[KAUF26] Draft received in productsRoutes:", req.body);

 try {
   const { id, title, sku, status, images, attributes } = req.body;
   const normalizedAttributes = normalizeDraftAttributes(attributes);

   if (!title) {
     return res.status(400).json({ error: "Title is required to save a draft" });
   }

   // If ID provided, try to update existing draft
   if (id) {
     const [existingDraft] = await db.select()
       .from(productDrafts)
       .where(draftAccessWhere(req, Number(id)));

     if (existingDraft) {
       const priorImages = Array.isArray(existingDraft.images)
         ? (existingDraft.images as string[])
         : [];
       const resolvedImages = resolveDraftImagesForSave(
         images,
         normalizedAttributes,
         priorImages
       );
       const [updatedDraft] = await db.update(productDrafts)
         .set({
           title,
           sku: sku || null,
           status: status || 'draft',
           images: resolvedImages,
           attributes: normalizedAttributes,
           updatedAt: new Date()
         })
         .where(draftAccessWhere(req, Number(id)))
         .returning();

       console.log(
         `[KAUF26] Updated draft ID: ${updatedDraft.id} images=${resolvedImages.length}`
       );
       return res.status(200).json(updatedDraft);
     }
   }

   const resolvedImages = resolveDraftImagesForSave(
     images,
     normalizedAttributes
   );

   // Create new draft
   const [newDraft] = await db.insert(productDrafts)
     .values({
       userId: userIdForNewDraft(req),
       title,
       sku: sku || null,
       status: status || 'draft',
       images: resolvedImages,
       attributes: normalizedAttributes,
     })
     .returning();

   console.log(
     `[KAUF26] Created new draft ID: ${newDraft.id} images=${resolvedImages.length}`
   );
   return res.status(201).json(newDraft);

 } catch (error) {
   console.error("[KAUF26] Error saving product draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 2. FETCH ALL SAVED DRAFTS (GET) ---
router.get("/drafts/count", async (req, res) => {
 try {
   const visibility = draftVisibilityCondition(req);
   const baseQuery = db
     .select({
       id: productDrafts.id,
       title: productDrafts.title,
       sku: productDrafts.sku,
       attributes: productDrafts.attributes,
     })
     .from(productDrafts);
   const rows = visibility
     ? await baseQuery.where(visibility)
     : await baseQuery;

   const count = countUniqueProductDrafts(rows);
   return res.status(200).json({ count });
 } catch (error) {
   console.error("[KAUF26] Error counting product drafts:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

router.get("/drafts", async (req, res) => {
 try {
   const visibility = draftVisibilityCondition(req);
   const baseQuery = db.select().from(productDrafts);
   const allDrafts = visibility
     ? await baseQuery.where(visibility)
     : await baseQuery;
   console.log(`[KAUF26] Fetching ${allDrafts.length} total drafts`);
   return res.status(200).json(allDrafts);
 } catch (error) {
   console.error("[KAUF26] Error fetching product drafts:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 3. PROCESS CAMERA IMAGE WITH SCRAPERS (POST) ---
router.post("/scrape-from-camera", async (req, res) => {
 console.log("[KAUF26] Camera image received for scraping");

 try {
   const { imageBase64, title, sku } = req.body;

   if (!imageBase64) {
     return res.status(400).json({ error: "Image data is required" });
   }

   const [draftFromCamera] = await db.insert(productDrafts)
     .values({
       userId: userIdForNewDraft(req),
       title: title || "Camera Captured Product",
       sku: sku || null,
       status: 'processing',
       images: [imageBase64],
       attributes: {
         source: 'camera',
         capturedAt: new Date().toISOString(),
         scraperStatus: 'pending'
       },
     })
     .returning();

   console.log(`[KAUF26] Draft saved from camera with ID: ${draftFromCamera.id}`);

   const enrichedAttributes = {
     source: 'camera',
     capturedAt: new Date().toISOString(),
     scraperStatus: 'completed',
   };

   const [updatedDraft] = await db.update(productDrafts)
     .set({
       status: 'ready_for_posting',
       attributes: enrichedAttributes,
       updatedAt: new Date()
     })
     .where(eq(productDrafts.id, draftFromCamera.id))
     .returning();

   return res.status(200).json({
     message: "Camera image processed successfully",
     draft: updatedDraft,
   });

 } catch (error) {
   console.error("[KAUF26] Error processing camera image:", error);
   return res.status(500).json({ error: "Failed to process camera image with scrapers" });
 }
});

// --- 4. GET DRAFTS READY FOR MARKETPLACE POSTING (GET) ---
router.get("/drafts/ready-for-posting", async (req, res) => {
 try {
   const visibility = draftVisibilityCondition(req);
   const statusFilter = inArray(productDrafts.status, ["ready_for_posting", "requires_review"]);
   const readyDrafts = visibility
     ? await db.select()
       .from(productDrafts)
       .where(and(statusFilter, visibility))
     : await db.select()
       .from(productDrafts)
       .where(statusFilter);

   console.log(`[KAUF26] Found ${readyDrafts.length} drafts ready for posting`);
   return res.status(200).json({
     count: readyDrafts.length,
     drafts: readyDrafts
   });
 } catch (error) {
   console.error("[KAUF26] Error fetching ready drafts:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 5. POST A DRAFT TO MARKETPLACES (POST) ---
router.post("/drafts/:id/post-to-marketplaces", async (req, res) => {
 try {
   const draftId = req.params.id;
   const { marketplaces } = req.body;
   const marketplaceIds: string[] = Array.isArray(marketplaces) && marketplaces.length > 0
     ? marketplaces
     : (process.env.DEFAULT_PUBLISH_MARKETPLACES?.split(",").map((s) => s.trim()) ?? ["ebay", "allegro"]);

   const [draft] = await db.select()
     .from(productDrafts)
     .where(draftAccessWhere(req, Number(draftId)));

   if (!draft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   if (
     draft.status !== "ready_for_posting" &&
     draft.status !== "requires_review" &&
     draft.status !== "draft"
   ) {
     return res.status(400).json({
       error: `Draft status is '${draft.status}', need 'ready_for_posting', 'requires_review', or 'draft'`,
     });
   }

   console.log(`[KAUF26] Queueing draft ${draftId} to marketplaces:`, marketplaceIds);

   const { draftToPublishPayload } = await import("./publishToMarketplaces");
   const payload = draftToPublishPayload(draft);

   const [job] = await db.insert(publishJobs)
     .values({ productData: payload })
     .returning();

   await db.insert(publishTasks).values(
     marketplaceIds.map((marketplaceId: string) => ({
       jobId: job.id,
       marketplaceId,
       status: "pending",
       attempts: 0,
     }))
   );

   const currentAttributes = draft.attributes && typeof draft.attributes === 'object'
     ? draft.attributes
     : {};

   const updatedAttributes = normalizeDraftAttributes({
     ...currentAttributes,
     publishJobId: job.id,
     queuedMarketplaces: marketplaceIds,
     queuedAt: new Date().toISOString(),
   });

   const [postedDraft] = await db.update(productDrafts)
     .set({
       status: 'ready_for_posting',
       attributes: updatedAttributes,
       updatedAt: new Date()
     })
     .where(draftAccessWhere(req, Number(draftId)))
     .returning();

   return res.status(202).json({
     message: "Publishing tasks queued",
     jobId: job.id,
     marketplaces: marketplaceIds,
     draft: postedDraft,
   });

 } catch (error) {
   console.error("[KAUF26] Error posting to marketplaces:", error);
   return res.status(500).json({ error: "Failed to post to marketplaces" });
 }
});

// --- 6. UPLOAD DRAFT PHOTOS (multipart) ---
router.post(
  "/drafts/:id/upload-photos",
  (req, res, next) => {
    draftPhotoUpload.array("images", 5)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid upload",
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const draftId = Number(req.params.id);
      if (!Number.isFinite(draftId)) {
        return res.status(400).json({ error: "Invalid draft id" });
      }

      const [draft] = await db
        .select()
        .from(productDrafts)
        .where(draftAccessWhere(req, draftId));

      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      const existing = collectDraftImages({
        images: draft.images,
        attributes: draft.attributes as Record<string, unknown>,
      });

      if (existing.length + files.length > MAX_DRAFT_IMAGES) {
        return res.status(400).json({
          error: `Upload would exceed the ${MAX_DRAFT_IMAGES}-image limit (currently ${existing.length})`,
        });
      }

      await ensureUploadsDir();
      const urls = filesToPublicUrls(files);

      return res.status(200).json({ urls });
    } catch (error) {
      console.error("[KAUF26] Error uploading draft photos:", error);
      return res.status(500).json({ error: "Failed to upload photos" });
    }
  }
);

// --- 7. ADD PHOTO URLS TO DRAFT (POST) ---
router.post("/drafts/:id/add-photos", async (req, res) => {
  try {
    const draftId = Number(req.params.id);
    if (!Number.isFinite(draftId)) {
      return res.status(400).json({ error: "Invalid draft id" });
    }

    const [existingDraft] = await db
      .select()
      .from(productDrafts)
      .where(draftAccessWhere(req, draftId));

    if (!existingDraft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const existingImages = collectDraftImages({
      images: existingDraft.images,
      attributes: existingDraft.attributes as Record<string, unknown>,
    });

    const validation = validateAddPhotosRequest(
      req.body?.imageUrls,
      existingImages
    );
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const { merged, added, duplicates } = mergeUniqueDraftImageUrls(
      existingImages,
      validation.imageUrls
    );

    if (added.length === 0) {
      return res.status(400).json({
        error:
          duplicates.length > 0
            ? "All provided photos are already on this draft"
            : "No new photos to add",
        duplicates,
      });
    }

    const priorAttributes =
      existingDraft.attributes && typeof existingDraft.attributes === "object"
        ? (existingDraft.attributes as Record<string, unknown>)
        : {};

    const updatedAttributes = syncDraftImageAttributes(
      normalizeDraftAttributes(priorAttributes),
      merged
    );

    const [updatedDraft] = await db
      .update(productDrafts)
      .set({
        images: merged,
        attributes: updatedAttributes,
        updatedAt: new Date(),
      })
      .where(draftAccessWhere(req, draftId))
      .returning();

    console.log(
      `[KAUF26] Added ${added.length} photo(s) to draft ${draftId} (total ${merged.length})`
    );

    return res.status(200).json({
      draft: updatedDraft,
      added,
      duplicates,
      imageCount: merged.length,
    });
  } catch (error) {
    console.error("[KAUF26] Error adding photos to draft:", error);
    return res.status(500).json({ error: "Failed to add photos to draft" });
  }
});

// --- 8. GET DRAFT BY ID (GET) ---
router.get("/drafts/:id", async (req, res) => {
 try {
   const draftId = req.params.id;
   const [draft] = await db.select()
     .from(productDrafts)
     .where(draftAccessWhere(req, Number(draftId)));

   if (!draft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   return res.status(200).json(draft);
 } catch (error) {
   console.error("[KAUF26] Error fetching draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 9. PARTIAL DRAFT UPDATE (PATCH) ---
router.patch("/drafts/:id", async (req, res) => {
 try {
   const draftId = Number(req.params.id);
   const [existingDraft] = await db.select()
     .from(productDrafts)
     .where(draftAccessWhere(req, draftId));

   if (!existingDraft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   const { title, sku, status, images, attributes } = req.body ?? {};
   const mergedAttributes = normalizeDraftAttributes({
     ...(existingDraft.attributes as Record<string, unknown>),
     ...(attributes ?? {}),
   });

   const [updatedDraft] = await db.update(productDrafts)
     .set({
       ...(title !== undefined ? { title } : {}),
       ...(sku !== undefined ? { sku } : {}),
       ...(status !== undefined ? { status } : {}),
       ...(images !== undefined ? { images } : {}),
       attributes: mergedAttributes,
       updatedAt: new Date(),
     })
     .where(draftAccessWhere(req, draftId))
     .returning();

   console.log(`[KAUF26] Patched draft ID: ${updatedDraft.id}`);
   return res.status(200).json(updatedDraft);
 } catch (error) {
   console.error("[KAUF26] Error patching draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 10. UPDATE DRAFT STATUS (PATCH) ---
router.patch("/drafts/:id/status", async (req, res) => {
 try {
   const draftId = req.params.id;
   const { status } = req.body;

   if (
     !status ||
     !["draft", "processing", "ready_for_posting", "requires_review", "posted"].includes(
       status
     )
   ) {
     return res.status(400).json({ error: "Invalid status value" });
   }

   const [updatedDraft] = await db.update(productDrafts)
     .set({
       status: status,
       updatedAt: new Date()
     })
     .where(draftAccessWhere(req, Number(draftId)))
     .returning();

   if (!updatedDraft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   console.log(`[KAUF26] Updated draft ${draftId} status to: ${status}`);
   return res.status(200).json(updatedDraft);
 } catch (error) {
   console.error("[KAUF26] Error updating draft status:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 11. DELETE DRAFT (DELETE) ---
router.delete("/drafts/:id", async (req, res) => {
 try {
   const draftId = req.params.id;
   const [deletedDraft] = await db.delete(productDrafts)
     .where(draftAccessWhere(req, Number(draftId)))
     .returning();

   if (!deletedDraft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   console.log(`[KAUF26] Deleted draft ${draftId}`);
   return res.status(200).json({ message: "Draft deleted successfully", draft: deletedDraft });
 } catch (error) {
   console.error("[KAUF26] Error deleting draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- DEBUG routes (development only) ---
if (process.env.NODE_ENV !== "production") {
router.get("/debug/all-drafts", async (_req, res) => {
 try {
   const allDrafts = await db.select().from(productDrafts);
   res.json({
     count: allDrafts.length,
     drafts: allDrafts.map(d => ({
       id: d.id,
       title: d.title,
       status: d.status,
       sku: d.sku,
       createdAt: d.createdAt,
       updatedAt: d.updatedAt,
       hasImages: d.images ? d.images.length : 0,
       attributes: d.attributes
     }))
   });
 } catch (error) {
   console.error("[DEBUG] Error fetching drafts:", error);
   res.status(500).json({ error: "Failed to fetch drafts" });
 }
});

// --- 10. DEBUG: Clear all drafts (BE CAREFUL WITH THIS) ---
router.delete("/debug/clear-all-drafts", async (_req, res) => {
 try {
   const result = await db.delete(productDrafts).returning();
   console.log(`[DEBUG] Deleted ${result.length} drafts`);
   res.json({
     message: `Deleted ${result.length} drafts`,
     deleted: result.map(d => ({ id: d.id, title: d.title }))
   });
 } catch (error) {
   console.error("[DEBUG] Error clearing drafts:", error);
   res.status(500).json({ error: "Failed to clear drafts" });
 }
});

// --- 11. DEBUG: Get database stats ---
router.get("/debug/stats", async (_req, res) => {
 try {
   const allDrafts = await db.select().from(productDrafts);
   const statusCounts = {
     draft: allDrafts.filter(d => d.status === 'draft').length,
     processing: allDrafts.filter(d => d.status === 'processing').length,
     ready_for_posting: allDrafts.filter(d => d.status === 'ready_for_posting').length,
     posted: allDrafts.filter(d => d.status === 'posted').length,
   };

   res.json({
     totalDrafts: allDrafts.length,
     statusCounts,
     lastUpdated: new Date().toISOString()
   });
 } catch (error) {
   console.error("[DEBUG] Error getting stats:", error);
   res.status(500).json({ error: "Failed to get stats" });
 }
});
}

export { router as productRoutes };