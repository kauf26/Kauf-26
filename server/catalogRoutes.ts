<<<<<<< HEAD
import express, { type Express, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import OpenAI from "openai";

// 1. Database import
import * as Database from "./db";
const storage = (Database as any).storage;

// 2. Shared Limits logic
import * as Limits from "../shared/limits";
const buildDailyProductLimitLockoutBody = (Limits as any).buildDailyProductLimitLockoutBody;
const DAILY_PRODUCT_CREATE_LIMIT = (Limits as any).DAILY_PRODUCT_CREATE_LIMIT || 10;

// 3. Unified Services
import * as Unified from "./services/unified";
const currencyRates = (Unified as any).currencyRates || {};
const resolveMarketplaceLocale = (Unified as any).resolveMarketplaceLocale;

// 4. Schema, Timezone, and your NEW OpenAI Service
import type { Listing } from "../shared/schema";
import { getClientIanaTimeZone } from "./clientTimezone";
import { analyzeProductImage } from "./services/openai"; // <--- Added this

const router = express.Router();

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
});

// Configure Multer for local storage
const upload = multer({
 storage: multer.diskStorage({
   destination: async (_req, _file, cb) => {
     const uploadDir = path.join(process.cwd(), "uploads");
     try {
       await fs.mkdir(uploadDir, { recursive: true });
       cb(null, uploadDir);
     } catch (err) {
       cb(err as Error, uploadDir);
     }
   },
   filename: (_req, file, cb) => {
     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
     cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
   },
 }),
 limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Main setup function
export function setupCatalogRoutes(app: Express) {
 app.use("/api/catalog", router);

 /**
  * NEW ROUTE: AI Image Analysis
  * This takes the photo and returns the suggested listing details.
  */
 router.post("/analyze", upload.single("image"), async (req: Request, res: Response) => {
   try {
     if (!req.file) {
       return res.status(400).json({ error: "No image uploaded" });
     }

     // Call the new service we just created
     const analysis = await analyzeProductImage(req.file.path);

     res.status(200).json({
       message: "Analysis successful",
       data: analysis,
       tempImagePath: req.file.path
     });
   } catch (error) {
     console.error("Analysis route error:", error);
     res.status(500).json({ error: "AI analysis failed to process the image" });
   }
 });

 /**
  * EXISTING ROUTE: Create Product
  */
 router.post("/create", upload.single("image"), async (req: Request, res: Response) => {
   try {
     const userId = 1;
     let lockout = { isLocked: false };

     if (typeof buildDailyProductLimitLockoutBody === 'function') {
       lockout = await buildDailyProductLimitLockoutBody(userId);
     }

     if (lockout.isLocked) {
       return res.status(429).json({ message: "Limit reached", ...lockout });
     }

     res.status(200).json({
       message: "Kauf26 Catalog Service Online",
       activeLimit: DAILY_PRODUCT_CREATE_LIMIT
     });
   } catch (error) {
     res.status(500).json({ error: "Internal Server Error" });
   }
 });
}
=======
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
>>>>>>> 2054f48

export default router;