import "dotenv/config";
import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import multer from "multer";
import OpenAI from "openai";
import {
  scrapeProduct as fetchMasterProductData,
  correctMisclassifiedCategory,
} from "./scrapers/masterScraper";
import { productRoutes } from "./productsRoutes";

const ALLOWED_CATEGORIES = [
  "Electronics",
  "Watches",
  "Clothing",
  "Shoes",
  "Accessories",
  "Home",
  "Other",
] as const;

interface ScrapedProduct {
 brand?: string;
 year?: string;
 condition?: string;
 material?: string;
 refNumber?: string;
 description?: string;
 price?: string | number;
 ebayPrice?: string | number;
}

type VisionProduct = {
  title: string;
  brand?: string;
  category?: string;
  condition?: string;
  price?: number | null;
  description?: string;
};

type ScrapedListing = ScrapedProduct & {
  title?: string;
  category?: string;
  isExactMatch?: boolean;
};

const VISION_IDENTIFY_PROMPT = `You are a product identification expert analyzing a product photo for a resale listing.

CRITICAL:
- Identify ONLY the main physical product in focus (phone, watch, shoes, bag, etc.).
- IGNORE text on stickers, labels, packaging, posters, or background objects.
- Do NOT use incidental text (band names, slogans, unrelated brands) as the product title.

Return ONLY valid JSON:
{
  "title": "specific product name (e.g. iPhone 12 Pro, Rolex Submariner)",
  "brand": "brand if visible or reasonably inferred, else empty string",
  "category": "one of: Electronics, Watches, Clothing, Shoes, Accessories, Home, Other",
  "condition": "one of: New, Used, Like New",
  "price": estimated USD market price as a number, or null if unknown,
  "description": "1-2 sentences describing only the main product"
}

Rules:
- Smartphones, cell phones, tablets → category MUST be "Electronics", never "Watches".
- Wristwatches only → "Watches".
- Be specific in title; never name the product after sticker or background text.`;

function parseVisionResponse(content: string): VisionProduct | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<VisionProduct>;
    if (!parsed.title || typeof parsed.title !== "string") return null;
    const category = ALLOWED_CATEGORIES.includes(
      parsed.category as (typeof ALLOWED_CATEGORIES)[number]
    )
      ? parsed.category
      : "Other";
    return {
      title: parsed.title.trim(),
      brand: parsed.brand?.trim() || "",
      category,
      condition: parsed.condition || "Used",
      price: parsed.price ?? null,
      description: parsed.description?.trim() || "",
    };
  } catch {
    return null;
  }
}

function mergeListingWithVision(
  scraped: ScrapedListing | null,
  vision: VisionProduct
): ScrapedListing {
  const base = scraped ?? {};
  return {
    ...base,
    title: base.title ?? vision.title,
    brand: base.brand ?? vision.brand ?? "",
    category: base.category ?? vision.category ?? "Other",
    condition: base.condition ?? vision.condition ?? "Used",
    description:
      base.description ??
      vision.description ??
      `Identified: ${vision.title}`,
    price: base.price ?? vision.price ?? 0,
    isExactMatch: scraped?.isExactMatch ?? false,
  };
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// -------------------- IDENTIFY ROUTE (image -> scrape -> save to drafts) --------------------
app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
 try {
   console.log("📸 [1/5] Image received. File size:", req.file?.size);

   if (!req.file) {
     console.log("❌ No file in request");
     return res.status(400).json({ error: "No image uploaded" });
   }

   const base64Image = req.file.buffer.toString('base64');

   console.log("🤖 [2/5] Calling OpenAI vision to identify product...");
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     response_format: { type: "json_object" },
     messages: [{
       role: "user",
       content: [
         { type: "text", text: VISION_IDENTIFY_PROMPT },
         { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
       ]
     }],
   });

   const visionRaw = response.choices[0].message.content || "";
   const vision =
     parseVisionResponse(visionRaw) ??
     ({ title: visionRaw.trim(), category: "Other", condition: "Used" } as VisionProduct);
   const searchQuery = vision.title;
   console.log("🔍 [3/5] Vision identified:", JSON.stringify(vision, null, 2));

   console.log("🕸️ [4/5] Calling scraper with query:", searchQuery);
   const scrapedRaw = await fetchMasterProductData(searchQuery);
   const listings = correctMisclassifiedCategory(
     mergeListingWithVision(scrapedRaw, vision) as Record<string, unknown>
   ) as ScrapedListing;
   console.log("📦 Scraper returned:", JSON.stringify(listings, null, 2));

   // ✨ NEW: Save as a draft in the database
   const draftData = {
     title: listings.title ?? searchQuery,
     sku: listings.refNumber || `AUTO-${Date.now()}`,
     status: 'ready_for_posting', // This makes it appear on page 3
     images: [`data:${req.file.mimetype};base64,${base64Image}`],
     attributes: {
       brand: listings.brand || "Unknown",
       year: listings.year || new Date().getFullYear().toString(),
       condition: listings.condition || "Used",
       material: listings.material || "Not specified",
       aiDescription: listings.description || `KAUF-AI identified as: ${searchQuery}`,
       marketPrices: {
         allegroAvg: listings.price || "0.00",
         ebayAvg: listings.ebayPrice || "0.00",
         recommendedPrice: listings.price || "0.00"
       },
       source: 'ai_identified',
       identifiedAt: new Date().toISOString()
     }
   };

   console.log("💾 [5/5] Saving draft to database...");

   // Save to database using your existing productRoutes logic
   const saveResponse = await fetch(`http://localhost:${PORT}/api/drafts`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(draftData)
   });

   if (!saveResponse.ok) {
     throw new Error(`Failed to save draft: ${saveResponse.statusText}`);
   }

   const savedDraft = await saveResponse.json();
   console.log("✅ Draft saved successfully with ID:", savedDraft.id || savedDraft);

   // Normalized response for ProductDraft / sessionStorage (Task A)
   const capturedImage = `data:${req.file.mimetype};base64,${base64Image}`;
   const allegroAvg = listings.price ?? "0.00";
   const ebayAvg = listings.ebayPrice ?? listings.price ?? "0.00";

   const isExactMatch = listings.isExactMatch ?? false;

   res.json({
     success: true,
     draftId: savedDraft.id ?? savedDraft,
     isExactMatch,
     product: {
       title: listings.title ?? searchQuery,
       description: listings.description ?? vision.description ?? "",
       price: String(listings.price ?? vision.price ?? 0),
       brand: listings.brand ?? vision.brand ?? "",
       category: listings.category ?? vision.category ?? "Other",
       condition: listings.condition ?? vision.condition ?? "Used",
       allegroAvg: String(allegroAvg),
       ebayAvg: String(ebayAvg),
       capturedImage,
       isExactMatch,
     },
   });
 } catch (error) {
   console.error("❌ Identification Error:", error);
   res.status(500).json({ error: "Scraping or identification failed" });
 }
});

// -------------------- HEALTH CHECK ROUTE --------------------
app.get('/api/health', (req: Request, res: Response) => {
 res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------- SERVER SETUP --------------------
const server = createServer(app);

(async () => {
 console.log("DEBUG: About to call registerRoutes");
 await registerRoutes(app);

 if (app.get("env") === "development") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 server.listen(PORT, "0.0.0.0", () => {
   console.log(`🚀 Unified Kauf26 engine running on port ${PORT}`);
   console.log(`📋 API endpoints available:`);
   console.log(`   - POST /api/identify (multipart image → OpenAI → scrape → draft)`);
   console.log(`   - POST /api/catalog/scrape (JSON { query } → masterScraper)`);
   console.log(`   - GET  /api/health`);
   console.log(`   - GET/POST /api/drafts (productsRoutes → PostgreSQL)`);
   console.log(`   - GET  /api/drafts/ready-for-posting`);
   console.log(`   - POST /api/drafts/:id/post-to-marketplaces`);
   console.log(`   - POST /api/products/save`);
   console.log(`   - POST /api/create-checkout-session`);
   console.log(`   - POST /api/create-hold`);
 });
})();