import { Router } from "express";
// Points directly to the 'db.ts' and 'schema.ts' files in your server folder
import { db } from "server/db";
import { catalogItems } from "../shared/schema";

import { eq } from "drizzle-orm";

const router = Router();

// 1. GET ALL CATALOG ITEMS
router.get("/", async (_req, res) => {
 try {
   const items = await db.select().from(catalogItems);
   res.json(items);
 } catch (error) {
   console.error("Fetch error:", error);
   res.status(500).json({ message: "Failed to fetch catalog items" });
 }
});

// 2. GET SINGLE ITEM BY ID
router.get("/:id", async (req, res) => {
 try {
   const id = parseInt(req.params.id);
   if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

   const [item] = await db
     .select()
     .from(catalogItems)
     .where(eq(catalogItems.id, id));

   if (!item) {
     return res.status(404).json({ message: "Item not found" });
   }
   res.json(item);
 } catch (error) {
   res.status(500).json({ message: "Error retrieving item" });
 }
});

// 3. CREATE NEW ITEM
router.post("/", async (req, res) => {
 try {
   const newItem = await db.insert(catalogItems).values(req.body).returning();
   res.status(201).json(newItem[0]);
 } catch (error) {
   res.status(400).json({ message: "Could not create item" });
 }
});

// 4. DELETE ITEM
router.delete("/:id", async (req, res) => {
 try {
   const id = parseInt(req.params.id);
   await db.delete(catalogItems).where(eq(catalogItems.id, id));
   res.status(204).end();
 } catch (error) {
   res.status(500).json({ message: "Could not delete item" });
 }
});

export default router;