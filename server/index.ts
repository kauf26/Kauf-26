import "dotenv/config";
import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import multer from "multer";
import OpenAI from "openai";
import { scrapeProduct as fetchMasterProductData } from "./scrapers/masterScraper";
import { productRoutes } from "./productsRoutes";
import marketplaceRoutes from "./marketplaceRoutes";
import { startMarketplaceWorker } from "./marketplaceWorker";

/** First non-empty category wins; "Other" only when all are blank */
function coalesceCategory(
  ...candidates: (string | undefined | null)[]
): string {
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return "Other";
}

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

type VisionConfidence = "high" | "medium" | "low";

type VisionProduct = {
  title: string;
  brand?: string;
  category?: string;
  condition?: string;
  price?: number | null;
  description?: string;
  confidence: VisionConfidence;
};

type MatchType = "exact" | "similar" | "generic";

type ScrapedListing = ScrapedProduct & {
  title?: string;
  category?: string;
  isExactMatch?: boolean;
  matchType?: MatchType;
  allegroAvg?: string | number;
  ebayAvg?: string | number;
};

const VISION_IDENTIFY_PROMPT = `You are a product identification expert analyzing a product photo for a resale listing.

CRITICAL:
- Identify ONLY the main physical product in focus (any item: apparel, electronics, home goods, toys, sports gear, tools, etc.).
- IGNORE background clutter not part of the product.
- USE text/logos printed ON the product (brand names, venue names, team names) for brand and title when they identify the item.
- Use a specific descriptive title for the actual product, not vague scene descriptions.

Return ONLY valid JSON:
{
  "title": "specific product name",
  "brand": "brand or text on product if visible, else empty string",
  "category": "accurate marketplace category for this item (any appropriate label)",
  "condition": "one of: New, Used, Like New",
  "price": estimated USD resale price as a number; use 0 if unknown,
  "confidence": "high" | "medium" | "low",
  "description": "1-2 sentences describing the product for a listing"
}

Guidance:
- Pick category and price that fit THIS item (e.g. small low-cost items vs luxury goods).
- Include visible on-product text in brand/title when helpful (e.g. bar name on a cap).
- Do not use the word "General" as category — choose a specific category.
- confidence:
  - "high": clear product, recognizable brand/model (e.g. iPhone in frame).
  - "medium": identifiable type but limited detail (generic sneakers, unbranded mug).
  - "low": unclear photo, unusual/generic object, or you cannot confidently name a specific SKU.
    For low confidence use a simple generic title (e.g. "Eyeglass cleaning cloth"), set price to 0.

Examples (format only):

Phone: { "title": "iPhone 12", "brand": "Apple", "category": "Electronics", "condition": "Used", "price": 299.99, "confidence": "high", "description": "..." }

Cap with logo: { "title": "The Shack Baseball Cap", "brand": "The Shack", "category": "Clothing", "condition": "Used", "price": 15, "confidence": "medium", "description": "..." }

Small toy: { "title": "Yellow Stress Ball", "brand": "", "category": "Toys", "condition": "Used", "price": 8, "confidence": "medium", "description": "..." }

Cleaning cloth (blurry/generic): { "title": "Eyeglass cleaning cloth", "brand": "", "category": "Accessories", "condition": "Used", "price": 0, "confidence": "low", "description": "Soft microfiber cloth for cleaning eyeglasses." }`;

function parseVisionResponse(content: string): VisionProduct | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<VisionProduct>;
    if (!parsed.title || typeof parsed.title !== "string") return null;
    const title = parsed.title.trim();
    const categoryFromVision = String(parsed.category ?? "").trim();
    const rawConf = parsed.confidence;
    const confidence: VisionConfidence =
      rawConf === "high" || rawConf === "medium" || rawConf === "low"
        ? rawConf
        : "medium";
    return {
      title,
      brand: parsed.brand?.trim() || "",
      category: coalesceCategory(categoryFromVision),
      condition: parsed.condition || "Used",
      price: parsed.price ?? 0,
      description: parsed.description?.trim() || "",
      confidence,
    };
  } catch {
    return null;
  }
}

const TITLE_STOP_WORDS = new Set([
  "with", "from", "that", "this", "your", "for", "the", "and", "new", "used",
]);

function significantTitleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !TITLE_STOP_WORDS.has(w))
  );
}

function titlesAreVeryDifferent(visionTitle: string, scraperTitle: string): boolean {
  const a = significantTitleTokens(visionTitle);
  const b = significantTitleTokens(scraperTitle);
  if (a.size === 0 || b.size === 0) return false;
  let overlap = 0;
  for (const w of a) if (b.has(w)) overlap++;
  const union = a.size + b.size - overlap;
  const jaccard = union > 0 ? overlap / union : 0;
  return jaccard < 0.15;
}

function truncateWords(text: string, maxWords = 50): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function buildGenericFromVision(vision: VisionProduct): ScrapedListing {
  return {
    title: vision.title,
    brand: vision.brand ?? "",
    category: coalesceCategory(vision.category, "Accessories"),
    condition: vision.condition ?? "Used",
    description: truncateWords(vision.description ?? "", 50),
    price: 0,
    allegroAvg: 0,
    ebayAvg: 0,
    isExactMatch: false,
    matchType: "generic",
  };
}

const LOW_COST_CATEGORY_KEYWORDS = ["accessories", "clothing", "toys", "apparel"];

function isLowCostCategory(category: string): boolean {
  const c = category.toLowerCase();
  return LOW_COST_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

function applyPriceSanityCheck(
  listing: ScrapedListing,
  vision: VisionProduct
): ScrapedListing {
  const category = coalesceCategory(listing.category, vision.category);
  const priceNum = parseFloat(String(listing.price ?? 0)) || 0;
  if (!isLowCostCategory(category) || priceNum <= 50) return listing;
  console.warn(
    `[Identify] Price sanity: ${priceNum} → 0 for low-cost category "${category}"`
  );
  return {
    ...listing,
    price: 0,
    allegroAvg: 0,
    ebayAvg: 0,
    isExactMatch: false,
    matchType: "generic",
  };
}

function mergeListingWithVision(
  scraped: ScrapedListing | null,
  vision: VisionProduct
): ScrapedListing {
  if (!scraped) {
    return {
      title: vision.title,
      brand: vision.brand ?? "",
      category: coalesceCategory(vision.category),
      condition: vision.condition ?? "Used",
      description: vision.description ?? "",
      price: vision.price ?? 0,
      allegroAvg: vision.price ?? 0,
      ebayAvg: vision.price ?? 0,
      isExactMatch: false,
      matchType: "generic",
    };
  }

  const matchType: MatchType =
    scraped.matchType ??
    (scraped.isExactMatch ? "exact" : "similar");

  if (matchType === "exact") {
    return {
      ...scraped,
      isExactMatch: true,
      matchType: "exact",
      allegroAvg: scraped.allegroAvg ?? scraped.price,
      ebayAvg: scraped.ebayAvg ?? scraped.ebayPrice ?? scraped.price,
    };
  }

  if (matchType === "similar") {
    return {
      ...scraped,
      title: scraped.title ?? vision.title,
      brand: String(scraped.brand || vision.brand || ""),
      category: coalesceCategory(scraped.category, vision.category),
      condition: scraped.condition ?? vision.condition ?? "Used",
      description: scraped.description ?? vision.description ?? "",
      price: scraped.price ?? vision.price ?? 0,
      allegroAvg: scraped.allegroAvg ?? scraped.price ?? 0,
      ebayAvg: scraped.ebayAvg ?? scraped.ebayPrice ?? scraped.price ?? 0,
      isExactMatch: false,
      matchType: "similar",
    };
  }

  return {
    title: scraped.title ?? vision.title,
    brand: String(scraped.brand || vision.brand || ""),
    category: coalesceCategory(scraped.category, vision.category),
    condition: scraped.condition ?? vision.condition ?? "Used",
    description: scraped.description ?? vision.description ?? "",
    price: scraped.price ?? vision.price ?? 0,
    allegroAvg: scraped.allegroAvg ?? scraped.price ?? vision.price ?? 0,
    ebayAvg:
      scraped.ebayAvg ?? scraped.ebayPrice ?? vision.price ?? 0,
    isExactMatch: false,
    matchType: "generic",
  };
}

/** Fill missing marketplace averages from listing price — does not change model price */
function fillMarketAverages(input: {
  price?: string | number;
  allegroAvg?: string | number;
  ebayAvg?: string | number;
}) {
  const priceNum = parseFloat(String(input.price ?? 0)) || 0;
  let allegro = parseFloat(String(input.allegroAvg ?? 0)) || 0;
  let ebay = parseFloat(String(input.ebayAvg ?? 0)) || 0;
  if (allegro <= 0 && priceNum > 0) allegro = priceNum;
  if (ebay <= 0 && priceNum > 0) ebay = Math.round(priceNum * 1.05);
  return {
    price: priceNum,
    allegroAvg: String(allegro),
    ebayAvg: String(ebay),
  };
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

// Marketplace publish queue (POST /api/marketplaces/publish, GET /api/marketplaces/status/:jobId)
app.use("/api/marketplaces", marketplaceRoutes);

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
   console.log("🔬 [Vision] Raw model response:", visionRaw);
   const vision = parseVisionResponse(visionRaw);
   console.log(
     "🔬 [Vision] Parsed vision object:",
     vision ? JSON.stringify(vision, null, 2) : "(parse failed — no valid title)"
   );

   if (!vision?.title?.trim()) {
     console.warn("❌ Vision could not identify product from image");
     return res.status(422).json({
       message:
         "Could not identify product – please try again with better lighting",
     });
   }

   console.log(
     "🔬 [Vision] Full parsed JSON:",
     JSON.stringify(vision, null, 2)
   );

   const searchQuery = vision.title;
   console.log("🔍 [3/5] Vision identified:", JSON.stringify(vision, null, 2));

   let listings: ScrapedListing;

   if (vision.confidence === "low") {
     console.log("⚠️ [4/5] Low vision confidence — skipping marketplace scraper");
     listings = buildGenericFromVision(vision);
   } else {
     console.log("🕸️ [4/5] Calling scraper with query:", searchQuery);
     const scrapedRaw = await fetchMasterProductData(searchQuery, {
       vision: {
         visionTitle: vision.title,
         visionBrand: vision.brand ?? "",
       },
     });
     const scraperTitle = String(scrapedRaw?.title ?? "").trim();
     if (
       scrapedRaw &&
       scraperTitle &&
       titlesAreVeryDifferent(vision.title, scraperTitle)
     ) {
       console.warn(
         `[Identify] Scraper title "${scraperTitle}" conflicts with vision "${vision.title}" — generic fallback`
       );
       listings = buildGenericFromVision(vision);
     } else {
       listings = mergeListingWithVision(scrapedRaw, vision);
       listings = applyPriceSanityCheck(listings, vision);
     }
   }

   console.log("📦 Listing result:", JSON.stringify(listings, null, 2));

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
         allegroAvg: String(listings.allegroAvg ?? listings.price ?? "0.00"),
         ebayAvg: String(listings.ebayAvg ?? listings.ebayPrice ?? "0.00"),
         recommendedPrice: String(listings.price ?? "0.00"),
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
   const market = fillMarketAverages({
     price: listings.price ?? vision.price ?? 0,
     allegroAvg: listings.allegroAvg ?? listings.price,
     ebayAvg: listings.ebayAvg ?? listings.ebayPrice,
   });

   const matchType: MatchType = listings.matchType ?? "generic";
   const isExactMatch = matchType === "exact";

   res.json({
     success: true,
     draftId: savedDraft.id ?? savedDraft,
     isExactMatch,
     matchType,
     confidence: vision.confidence,
     product: {
       title: listings.title ?? searchQuery,
       description: listings.description ?? vision.description ?? "",
       price: String(market.price),
       brand: listings.brand ?? vision.brand ?? "",
       category: coalesceCategory(listings.category, vision.category),
       condition: listings.condition ?? vision.condition ?? "Used",
       allegroAvg: market.allegroAvg,
       ebayAvg: market.ebayAvg,
       capturedImage,
       isExactMatch,
       matchType,
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
   console.log(`   - POST /api/marketplaces/publish`);
   console.log(`   - GET  /api/marketplaces/status/:jobId`);
   startMarketplaceWorker();
 });
})();