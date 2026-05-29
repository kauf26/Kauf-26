import express from 'express';
import { db } from './db';
import { productDrafts } from '../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// --- 1. SAVE OR UPDATE A DRAFT (POST) ---
router.post("/drafts", async (req, res) => {
 console.log("[KAUF26] Draft received in productsRoutes:", req.body);

 try {
   const { id, title, sku, status, images, attributes } = req.body;

   if (!title) {
     return res.status(400).json({ error: "Title is required to save a draft" });
   }

   // If ID provided, try to update existing draft
   if (id) {
     const [existingDraft] = await db.select()
       .from(productDrafts)
       .where(eq(productDrafts.id, Number(id)));

     if (existingDraft) {
       const [updatedDraft] = await db.update(productDrafts)
         .set({
           title,
           sku: sku || null,
           status: status || 'draft',
           images: images || [],
           attributes: attributes || {},
           updatedAt: new Date()
         })
         .where(eq(productDrafts.id, Number(id)))
         .returning();

       console.log(`[KAUF26] Updated draft ID: ${updatedDraft.id}`);
       return res.status(200).json(updatedDraft);
     }
   }

   // Create new draft
   const [newDraft] = await db.insert(productDrafts)
     .values({
       title,
       sku: sku || null,
       status: status || 'draft',
       images: images || [],
       attributes: attributes || {},
     })
     .returning();

   console.log(`[KAUF26] Created new draft ID: ${newDraft.id}`);
   return res.status(201).json(newDraft);

 } catch (error) {
   console.error("[KAUF26] Error saving product draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 2. FETCH ALL SAVED DRAFTS (GET) ---
router.get("/drafts", async (_req, res) => {
 try {
   const allDrafts = await db.select().from(productDrafts);
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
router.get("/drafts/ready-for-posting", async (_req, res) => {
 try {
   const readyDrafts = await db.select()
     .from(productDrafts)
     .where(eq(productDrafts.status, 'ready_for_posting'));

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

   const [draft] = await db.select()
     .from(productDrafts)
     .where(eq(productDrafts.id, Number(draftId)));

   if (!draft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   if (draft.status !== 'ready_for_posting') {
     return res.status(400).json({
       error: `Draft status is '${draft.status}', need 'ready_for_posting'`
     });
   }

   console.log(`[KAUF26] Posting draft ${draftId} to marketplaces:`, marketplaces);

   // Safely handle attributes that might be null
   const currentAttributes = draft.attributes && typeof draft.attributes === 'object'
     ? draft.attributes
     : {};

   const updatedAttributes = {
     ...currentAttributes,
     postedTo: marketplaces || [],
     postedAt: new Date().toISOString()
   };

   const [postedDraft] = await db.update(productDrafts)
     .set({
       status: 'posted',
       attributes: updatedAttributes,
       updatedAt: new Date()
     })
     .where(eq(productDrafts.id, Number(draftId)))
     .returning();

   return res.status(200).json({
     message: "Draft posted to marketplaces successfully",
     draft: postedDraft,
   });

 } catch (error) {
   console.error("[KAUF26] Error posting to marketplaces:", error);
   return res.status(500).json({ error: "Failed to post to marketplaces" });
 }
});

// --- 6. GET DRAFT BY ID (GET) ---
router.get("/drafts/:id", async (req, res) => {
 try {
   const draftId = req.params.id;
   const [draft] = await db.select()
     .from(productDrafts)
     .where(eq(productDrafts.id, Number(draftId)));

   if (!draft) {
     return res.status(404).json({ error: "Draft not found" });
   }

   return res.status(200).json(draft);
 } catch (error) {
   console.error("[KAUF26] Error fetching draft:", error);
   return res.status(500).json({ error: "Internal Server Error" });
 }
});

// --- 7. UPDATE DRAFT STATUS (PATCH) ---
router.patch("/drafts/:id/status", async (req, res) => {
 try {
   const draftId = req.params.id;
   const { status } = req.body;

   if (!status || !['draft', 'processing', 'ready_for_posting', 'posted'].includes(status)) {
     return res.status(400).json({ error: "Invalid status value" });
   }

   const [updatedDraft] = await db.update(productDrafts)
     .set({
       status: status,
       updatedAt: new Date()
     })
     .where(eq(productDrafts.id, Number(draftId)))
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

// --- 8. DELETE DRAFT (DELETE) ---
router.delete("/drafts/:id", async (req, res) => {
 try {
   const draftId = req.params.id;
   const [deletedDraft] = await db.delete(productDrafts)
     .where(eq(productDrafts.id, Number(draftId)))
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

// --- 9. DEBUG: Get all drafts with detailed info ---
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

export { router as productRoutes };