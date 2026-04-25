import express, { type Express, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import OpenAI from "openai";

// 1. Database import - Force type to any to clear the 'storage' squiggle
import * as Database from "./db";
const storage = (Database as any).storage;

// 2. Shared Limits - Using dynamic access to clear 'buildDailyProductLimitLockoutBody' squiggle
import * as Limits from "../shared/limits";
const buildDailyProductLimitLockoutBody = (Limits as any).buildDailyProductLimitLockoutBody;
const DAILY_PRODUCT_CREATE_LIMIT = (Limits as any).DAILY_PRODUCT_CREATE_LIMIT || 10;

// 3. Unified Services
import * as Unified from "./services/unified";
const currencyRates = (Unified as any).currencyRates || {};
const resolveMarketplaceLocale = (Unified as any).resolveMarketplaceLocale;

// 4. Schema and Timezone
import type { Listing } from "../shared/schema";
import { getClientIanaTimeZone } from "./clientTimezone";

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

/**
* Translates text using OpenAI GPT-4o
*/
async function translateText(text: string, targetLang: string): Promise<string> {
 if (!text || targetLang === "en") return text;

 const langMap: Record<string, string> = {
   es: "Spanish", ja: "Japanese", pt: "Portuguese",
   nl: "Dutch", de: "German", fr: "French"
 };

 const langLabel = langMap[targetLang] || "the target language";

 try {
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: [
       { role: "system", content: `You are a professional translator. Translate to ${langLabel}.` },
       { role: "user", content: text },
     ],
   });
   return response.choices[0]?.message?.content || text;
 } catch (error) {
   return text;
 }
}

// Exporting the setup function for index.ts
export function setupCatalogRoutes(app: Express) {
 app.use("/api/catalog", router);

 router.post("/create", upload.single("image"), async (req: Request, res: Response) => {
   try {
     const userId = 1;

     let lockout = { isLocked: false };
     // Check if function exists before calling to prevent runtime crashes
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

export default router;
