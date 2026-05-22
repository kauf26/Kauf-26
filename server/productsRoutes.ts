
import express from 'express';
import { db } from './db';
import { productDrafts } from '../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// --- 1. SAVE OR UPDATE A DRAFT (POST) ---
// Frontend calls: /api/drafts
// Router maps to: /drafts (which index.ts will correctly mount to /api/drafts)
router.post("/drafts", async (req, res) => {
try {
  const { id, title, sku, status, images, attributes } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required to save a draft" });
  }

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

      return res.status(200).json(updatedDraft);
    }
  }

  const [newDraft] = await db.insert(productDrafts)
    .values({
      title,
      sku: sku || null,
      status: status || 'draft',
      images: images || [],
      attributes: attributes || {},
    })
    .returning();

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
  return res.status(200).json(allDrafts);
} catch (error) {
  console.error("[KAUF26] Error fetching product drafts:", error);
  return res.status(500).json({ error: "Internal Server Error" });
}
});

export { router as productRoutes };