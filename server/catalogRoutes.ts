import express, { type Express, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import OpenAI from "openai";
import * as Database from "./db";
import { catalogItems } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as Limits from "../shared/limits";
import { analyzeProductImage } from "./services/openai";

// Cast database for local compatibility
const db = (Database as any).db;
const storage = (Database as any).storage;

const router = express.Router();

// Configure OpenAI
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

/**
* AI Image Analysis Route
*/
router.post("/analyze", upload.single("image"), async (req: Request, res: Response) => {
 try {
   if (!req.file) {
     return res.status(400).json({ error: "No image uploaded" });
   }

   const analysis = await analyzeProductImage(req.file.path);

   res.status(200).json({
     message: "Analysis successful",
     data: analysis,
     tempImagePath: req.file.path
   });
 } catch (error) {
   console.error("Analysis route error:", error);
   res.status(500).json({ error: "AI analysis failed" });
 }
});

/**
* GET ALL CATALOG ITEMS
*/
router.get("/", async (_req, res) => {
 try {
   const items = await db.select().from(catalogItems);
   res.json(items);
 } catch (error) {
   res.status(500).json({ message: "Failed to fetch items" });
 }
});

/**
* CREATE PRODUCT
*/
router.post("/", upload.single("image"), async (req: Request, res: Response) => {
 try {
   const newItem = await db.insert(catalogItems).values(req.body).returning();
   res.status(201).json(newItem[0]);
 } catch (error) {
   res.status(400).json({ message: "Could not create item" });
 }
});

/**
* DELETE ITEM
*/
router.delete("/:id", async (req, res) => {
 try {
   const id = parseInt(req.params.id);
   await db.delete(catalogItems).where(eq(catalogItems.id, id));
   res.status(204).end();
 } catch (error) {
   res.status(500).json({ message: "Could not delete item" });
 }
});

export function setupCatalogRoutes(app: Express) {
 app.use("/api/catalog", router);
}

export default router;
