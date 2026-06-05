import "dotenv/config";
import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import multer from "multer";
import OpenAI from "openai";
import { scrapeProduct as fetchMasterProductData } from "./scrapers/masterScraper";
import { SCRAPER_RACE_WINDOW_MS } from "./scrapers/scraperRace";
import { canScraperOverrideVision } from "./scrapers/exactMatchGate";
import { getFallbackPriceRange } from "./scrapers/fallbackPricing";
import { stripExternalUrlFields } from "./listingSanitizer";
import { SUPPORTED_MARKETPLACE_IDS } from "./publishToMarketplaces";
import { productRoutes } from "./productsRoutes";
import marketplaceRoutes from "./marketplaceRoutes";
import { startMarketplaceWorker } from "./marketplaceWorker";
import {
  enqueueIdentifyJob,
  IdentifyJobTimeoutError,
  IDENTIFY_JOB_TIMEOUT_MS,
} from "./identifyQueue";

/** Skip vague scraper categories like "General" */
function isWeakCategory(category: string): boolean {
  const s = category.toLowerCase().trim();
  return !s || s === "general" || s === "other";
}

/** First non-empty, specific category wins; empty string if none */
function coalesceCategory(
  ...candidates: (string | undefined | null)[]
): string {
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s && !isWeakCategory(s)) return s;
  }
  return "";
}

function normalizeBrand(brand: unknown): string {
  const s = String(brand ?? "").trim();
  return !s || s.toUpperCase() === "N/A" ? "" : s;
}

function normalizeCondition(condition: unknown): string {
  const s = String(condition ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "like new" || lower === "like-new") return "Like New";
  if (lower === "new") return "New";
  if (lower === "used") return "Used";
  if (lower === "fair") return "Fair";
  return s;
}

interface ScrapedProduct {
 brand?: string;
 model?: string;
 year?: string;
 condition?: string;
 material?: string;
 color?: string;
 style?: string;
 refNumber?: string;
 description?: string;
 longDescription?: string;
 price?: string | number;
 medianPrice?: string | number;
 priceMin?: string | number;
 priceMax?: string | number;
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
  material?: string;
  color?: string;
  style?: string;
  confidence: VisionConfidence;
};

type MatchType = "exact" | "similar" | "generic";

type ScrapedListing = ScrapedProduct & {
  title?: string;
  category?: string;
  isExactMatch?: boolean;
  matchType?: MatchType;
  matchValidation?: string;
  priceReliable?: boolean;
  allegroAvg?: string | number;
  ebayAvg?: string | number;
  scraperSource?: string;
  productUrl?: string;
  url?: string;
  link?: string;
  verificationWarning?: string;
  timedOut?: boolean;
  matchConfidence?: "low" | "medium" | "high";
  matchScore?: number;
  _scraperMetadata?: {
    source?: string | null;
    matchValidation?: string | null;
  };
  requiresManualReview?: boolean;
  priceMin?: string | number;
  priceMax?: string | number;
};

function visionToListing(vision: VisionProduct): ScrapedListing {
  return {
    title: vision.title,
    brand: normalizeBrand(vision.brand),
    category: coalesceCategory(vision.category) || "",
    condition: normalizeCondition(vision.condition) || "Used",
    material: String(vision.material ?? "").trim(),
    color: String(vision.color ?? "").trim(),
    style: String(vision.style ?? "").trim(),
    description: truncateWords(vision.description ?? "", 50),
    price:
      typeof vision.price === "number" && vision.price > 0 ? vision.price : 0,
    priceReliable: false,
    isExactMatch: false,
    matchType: "generic",
  };
}

function stripListingUrls(listing: ScrapedListing): ScrapedListing {
  const cleaned = stripExternalUrlFields({
    ...listing,
  } as Record<string, unknown>);
  return cleaned as ScrapedListing;
}

function scraperHasUsableProduct(scraped: ScrapedListing | null): boolean {
  if (!scraped) return false;
  const price = parseFloat(String(scraped.price ?? 0)) || 0;
  return (
    scraped.priceReliable === true &&
    price >= 5 &&
    (scraped.isExactMatch === true || scraped.matchType === "exact")
  );
}

function buildVisionFallback(vision: VisionProduct): ScrapedListing {
  const range = getFallbackPriceRange(vision.category, vision.title);
  return stripListingUrls({
    ...visionToListing(vision),
    price: range.suggested,
    medianPrice: range.suggested,
    priceMin: range.min,
    priceMax: range.max,
    allegroAvg: range.suggested,
    ebayAvg: range.suggested,
    priceReliable: false,
    isExactMatch: false,
    matchType: "generic",
    requiresManualReview: true,
    longDescription: String(vision.description ?? "").trim(),
    verificationWarning:
      "No marketplace product found — using estimated price range. Review before posting.",
  });
}

/** Vision-first merge: scraper never overwrites color, material, style, or short description */
function mergeVisionAndScraper(
  vision: VisionProduct,
  scraper: ScrapedListing
): ScrapedListing {
  const final: ScrapedListing = visionToListing(vision);

  const override = canScraperOverrideVision({
    visionTitle: vision.title,
    scraperTitle: String(scraper.title ?? ""),
    price: scraper.price,
    description: scraper.description,
    url: scraper.url ?? scraper.link ?? scraper.productUrl,
  });

  if (override.allowed) {
    final.title = String(scraper.title ?? vision.title).trim();
    final.brand =
      normalizeBrand(scraper.brand) || normalizeBrand(vision.brand);
    final.model = String(scraper.model ?? "").trim();
    final.isExactMatch = true;
    final.matchType = "exact";
    console.log(
      `[Identify] Scraper override allowed tokenMatch=${override.tokenMatch.toFixed(2)} title="${final.title}"`
    );
  } else if (override.reasons.length > 0) {
    console.log(
      `[Identify] Scraper override blocked: ${override.reasons.join(", ")}`
    );
    final.requiresManualReview = true;
  }

  const scrapedPrice = parseFloat(String(scraper.price ?? 0)) || 0;
  if (scraper.priceReliable === true && scrapedPrice > 0) {
    final.price = scrapedPrice;
    final.medianPrice =
      parseFloat(String(scraper.medianPrice ?? scrapedPrice)) || scrapedPrice;
    final.priceReliable = true;
    final.allegroAvg =
      parseFloat(String(scraper.allegroAvg ?? scrapedPrice)) || scrapedPrice;
    final.ebayAvg =
      parseFloat(
        String(scraper.ebayAvg ?? scraper.ebayPrice ?? scrapedPrice)
      ) || scrapedPrice;
  }

  const scraperLong = String(scraper.longDescription ?? "").trim();
  final.longDescription =
    scraperLong || String(vision.description ?? "").trim();

  final._scraperMetadata = {
    source: scraper.scraperSource ?? null,
    matchValidation: scraper.matchValidation ?? null,
  };

  if (!override.allowed) {
    if (scraper.matchType === "similar") final.matchType = "similar";
  }
  final.matchValidation = scraper.matchValidation;
  final.scraperSource = scraper.scraperSource;

  return stripListingUrls(final);
}

async function prepareDraftPublishing(draftId: number): Promise<number | null> {
  const auto =
    process.env.AUTO_QUEUE_PUBLISH?.trim() === "true" ||
    process.env.AUTO_QUEUE_PUBLISH === "1";
  if (!auto) return null;

  const marketplaces =
    process.env.DEFAULT_PUBLISH_MARKETPLACES?.split(",").map((s) => s.trim()) ??
    SUPPORTED_MARKETPLACE_IDS.slice(0, 2);

  try {
    const res = await fetch(
      `http://localhost:${PORT}/api/drafts/${draftId}/post-to-marketplaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaces }),
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { jobId?: number };
    console.log(
      `[Identify] Auto-queued publish job #${body.jobId} for draft ${draftId}`
    );
    return body.jobId ?? null;
  } catch (err) {
    console.warn("[Identify] Auto-publish queue failed:", err);
    return null;
  }
}

const VISION_IDENTIFY_PROMPT = `You are a product identification expert analyzing a product photo for a resale listing.

CRITICAL:
- Identify ONLY the main physical product in focus (any item: apparel, electronics, home goods, toys, sports gear, tools, etc.).
- IGNORE background clutter not part of the product.
- USE text/logos printed ON the product (brand names, venue names, team names) for brand and title when they identify the item.
- Pay attention to any small text, serial numbers, model numbers, or logos on the product — include them in the title when legible.
- Mentally "zoom in" on the sharpest legible text and logos; prefer readings from those details over guessing from shape alone.
- Use a specific descriptive title for the actual product (brand + model when visible), not vague scene descriptions like "analog pilot watch" when a brand name is visible.

Return ONLY valid JSON:
{
  "title": "specific product name",
  "brand": "brand or text on product if visible, else empty string",
  "category": "accurate marketplace category (e.g. Home & Kitchen, Electronics, Clothing — never \"General\")",
  "condition": "one of: New, Used, Like New",
  "price": resale price in USD as a number only if you are confident from visible context; otherwise null (never guess a low placeholder),
  "confidence": "high" | "medium" | "low",
  "description": "1-2 sentences for a resale listing: material, color, use case",
  "material": "primary material if visible or inferable (ceramic, glass, plastic, metal, wood, fabric, leather, etc.) or empty string",
  "color": "primary color(s), e.g. white and blue, two-tone, matte black — or empty string",
  "style": "optional pattern or style, e.g. striped, minimalist, vintage — or empty string"
}

Guidance:
- Pick an accurate marketplace category for the item type (e.g. mug → Home & Kitchen; phone → Electronics).
- Do NOT invent a conservative or placeholder price. Use null when resale value is unknown — marketplace scrapers will supply price.
- Infer material from visible texture (glazed ceramic, stainless steel, cotton fabric).
- Include color and style in description when helpful; keep description factual, not generic filler.
- Include visible on-product text in brand/title when helpful (e.g. bar name on a cap).
- Do not use the word "General" as category — choose a specific marketplace category.
- confidence: "high" = clear brand/model visible; "medium" = product type clear; "low" = very blurry. Always set price to null when unsure (not 0 for guessing).

Examples (format only):

Phone: { "title": "iPhone 12", "brand": "Apple", "category": "Electronics", "condition": "Used", "price": 299.99, "confidence": "high", "description": "..." }

Cap with logo: { "title": "The Shack Baseball Cap", "brand": "The Shack", "category": "Clothing", "condition": "Used", "price": 15, "confidence": "medium", "description": "..." }

Small toy: { "title": "Yellow Stress Ball", "brand": "", "category": "Toys", "condition": "Used", "price": 8, "confidence": "medium", "material": "rubber", "color": "yellow", "style": "", "description": "..." }

Ceramic mug: { "title": "Two-Tone Ceramic Mug", "brand": "", "category": "Home & Kitchen", "condition": "New", "price": null, "confidence": "medium", "material": "ceramic", "color": "white and blue", "style": "two-tone glaze", "description": "A ceramic mug with a two-tone glaze, suitable for coffee or tea." }

Cleaning cloth (blurry/generic): { "title": "Eyeglass cleaning cloth", "brand": "", "category": "Accessories", "condition": "Used", "price": 0, "confidence": "low", "material": "microfiber", "color": "", "style": "", "description": "Soft microfiber cloth for cleaning eyeglasses." }

Mug example: { "title": "Starbucks 16oz Ceramic Mug", "brand": "Starbucks", "category": "Home & Kitchen", "condition": "Used", "price": null, "confidence": "high", "description": "..." }`;

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
      price:
        typeof parsed.price === "number" && parsed.price > 0
          ? parsed.price
          : null,
      description: parsed.description?.trim() || "",
      material: String(parsed.material ?? "").trim(),
      color: String(parsed.color ?? "").trim(),
      style: String(parsed.style ?? "").trim(),
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

function isPlaceholderDescription(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("general item matching") ||
    t.includes("details pending manual review") ||
    t.includes("please review the details manually") ||
    t.length < 12
  );
}

function pickDescription(
  scrapedDesc: string | undefined,
  vision: VisionProduct
): string {
  const scraped = String(scrapedDesc ?? "").trim();
  const fromVision = String(vision.description ?? "").trim();
  if (fromVision && (!scraped || isPlaceholderDescription(scraped))) {
    return fromVision;
  }
  return scraped || fromVision;
}

function generateInformativeDescription(
  listing: ScrapedListing,
  vision: VisionProduct
): string {
  const title = String(listing.title ?? vision.title ?? "").trim();
  const brand = normalizeBrand(listing.brand) || normalizeBrand(vision.brand);
  const material = String(listing.material ?? vision.material ?? "").trim();
  const color = String(listing.color ?? vision.color ?? "").trim();
  const bits = [title];
  if (brand) bits.push(`by ${brand}`);
  const attrs = [color, material].filter(Boolean).join(", ");
  if (attrs) bits.push(`(${attrs})`);
  return bits.filter(Boolean).join(" ").trim();
}

function applyVisionEnrichment(
  listing: ScrapedListing,
  vision: VisionProduct
): ScrapedListing {
  const scrapedCategory = String(listing.category ?? "");
  const category = coalesceCategory(
    isWeakCategory(scrapedCategory) ? undefined : scrapedCategory,
    vision.category
  );
  const scrapedPrice = parseFloat(String(listing.price ?? 0)) || 0;
  const price = scrapedPrice > 0 ? scrapedPrice : 0;

  let description = truncateWords(pickDescription(listing.description, vision), 50);
  if (!description || isPlaceholderDescription(description)) {
    description = truncateWords(
      generateInformativeDescription(listing, vision),
      50
    );
  }

  return {
    ...listing,
    title: listing.title ?? vision.title,
    brand: normalizeBrand(listing.brand) || normalizeBrand(vision.brand),
    model: String(listing.model ?? "").trim(),
    category,
    material: String(listing.material ?? vision.material ?? "").trim(),
    color: String(listing.color ?? vision.color ?? "").trim(),
    style: String(listing.style ?? vision.style ?? "").trim(),
    condition:
      normalizeCondition(listing.condition) ||
      normalizeCondition(vision.condition) ||
      "Used",
    description,
    longDescription: String(listing.longDescription ?? "").trim(),
    price,
    medianPrice:
      parseFloat(String(listing.medianPrice ?? listing.price ?? 0)) || price,
  };
}

function buildGenericFromVision(
  vision: VisionProduct,
  warning?: string
): ScrapedListing {
  return {
    title: vision.title,
    brand: normalizeBrand(vision.brand),
    category: coalesceCategory(vision.category) || "",
    condition: normalizeCondition(vision.condition) || "Used",
    material: String(vision.material ?? "").trim(),
    color: String(vision.color ?? "").trim(),
    style: String(vision.style ?? "").trim(),
    description: truncateWords(vision.description ?? "", 50),
    price: 0,
    allegroAvg: 0,
    ebayAvg: 0,
    isExactMatch: false,
    matchType: "generic",
    priceReliable: false,
    verificationWarning:
      warning ??
      "No marketplace listing matched vision — manual verification recommended.",
  };
}

function mergeListingWithVision(
  scraped: ScrapedListing | null,
  vision: VisionProduct
): ScrapedListing {
  if (!scraped) {
    return buildGenericFromVision(vision);
  }

  const matchType: MatchType =
    scraped.matchType ??
    (scraped.isExactMatch ? "exact" : "similar");

  if (matchType === "exact") {
    return applyVisionEnrichment(
      {
        ...scraped,
        isExactMatch: true,
        matchType: "exact",
        allegroAvg: scraped.allegroAvg ?? scraped.price,
        ebayAvg: scraped.ebayAvg ?? scraped.ebayPrice ?? scraped.price,
      },
      vision
    );
  }

  if (matchType === "similar") {
    return applyVisionEnrichment(
      {
        ...scraped,
        isExactMatch: false,
        matchType: "similar",
        allegroAvg: scraped.allegroAvg ?? scraped.price ?? 0,
        ebayAvg: scraped.ebayAvg ?? scraped.ebayPrice ?? scraped.price ?? 0,
      },
      vision
    );
  }

  return applyVisionEnrichment(
    {
      ...scraped,
      isExactMatch: false,
      matchType: "generic",
      allegroAvg: scraped.allegroAvg ?? scraped.price ?? vision.price ?? 0,
      ebayAvg:
        scraped.ebayAvg ?? scraped.ebayPrice ?? vision.price ?? 0,
    },
    vision
  );
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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

// Marketplace publish queue (POST /api/marketplaces/publish, GET /api/marketplaces/status/:jobId)
app.use("/api/marketplaces", marketplaceRoutes);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

/** HTTP timeout: vision + full scraper race window + buffer */
const IDENTIFY_REQUEST_TIMEOUT_MS = Number(
  process.env.IDENTIFY_REQUEST_TIMEOUT_MS ??
    SCRAPER_RACE_WINDOW_MS + 20_000
);
const VISION_TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS ?? 10_000);

function applyScrapeMeta(
  listing: ScrapedListing,
  scrapedRaw: ScrapedListing | null
): ScrapedListing {
  return {
    ...listing,
    timedOut: scrapedRaw?.timedOut === true,
    matchConfidence: scrapedRaw?.matchConfidence ?? "low",
    matchScore: Number(scrapedRaw?.matchScore ?? 0),
  };
}

/** Vision + scrapers + draft save (runs inside identify queue). */
async function runIdentifyPipeline(req: Request, res: Response): Promise<void> {
 const identifyStart = Date.now();
 const identifyAttempt = Math.min(
   1,
   Math.max(0, Number((req.body as { attempt?: string })?.attempt ?? 0))
 );
 if (identifyAttempt >= 1) {
   console.log("[Identify] Second attempt – allowing fallback to generic");
 }
 const logStep = (label: string, since: number) => {
   console.log(`[Identify] ${label}: ${Date.now() - since}ms`);
   return Date.now();
 };
 let step = identifyStart;

   console.log(
     "📸 [1/5] Image received. File size:",
     req.file?.size,
     "attempt:",
     identifyAttempt
   );

   if (!req.file) {
     console.log("❌ No file in request");
     res.status(400).json({ error: "No image uploaded" });
     return;
   }

   const base64Image = req.file.buffer.toString('base64');

   console.log(`🤖 [2/5] Calling OpenAI vision (max ${VISION_TIMEOUT_MS}ms)...`);
   const visionResponse = await Promise.race([
     openai.chat.completions.create({
       model: "gpt-4o",
       response_format: { type: "json_object" },
       messages: [{
         role: "user",
         content: [
           { type: "text", text: VISION_IDENTIFY_PROMPT },
           { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
         ]
       }],
     }),
     new Promise<null>((resolve) =>
       setTimeout(() => resolve(null), VISION_TIMEOUT_MS)
     ),
   ]);

   if (!visionResponse) {
     console.warn(`[Identify] Vision timed out after ${VISION_TIMEOUT_MS}ms`);
     res.status(422).json({
       message: "Vision identification timed out — try again",
     });
     return;
   }

   const visionRaw = visionResponse.choices[0].message.content || "";
   console.log("🔬 [Vision] Raw model response:", visionRaw);
   const vision = parseVisionResponse(visionRaw);
   step = logStep("Vision complete", step);
   console.log(
     "🔬 [Vision] Parsed vision object:",
     vision ? JSON.stringify(vision, null, 2) : "(parse failed — no valid title)"
   );

   if (!vision?.title?.trim()) {
     console.warn("❌ Vision could not identify product from image");
     res.status(422).json({
       message:
         "Could not identify product – please try again with better lighting",
     });
     return;
   }

   console.log(
     "🔬 [Vision] Full parsed JSON:",
     JSON.stringify(vision, null, 2)
   );

   const searchQuery = vision.title;
   console.log("🔍 [3/5] Vision identified:", JSON.stringify(vision, null, 2));

   let listings: ScrapedListing;

   {
     console.log("🕸️ [4/5] Calling scraper with query:", searchQuery);
     const scrapeStart = Date.now();
     const scrapedRaw = (await fetchMasterProductData(searchQuery, {
       vision: {
         visionTitle: vision.title,
         visionBrand: vision.brand ?? "",
       },
       imageBase64: base64Image,
       imageMimeType: req.file.mimetype || "image/jpeg",
     })) as ScrapedListing | null;
     if (!scrapedRaw) {
       console.warn("[Identify] Scraper returned no result");
     } else {
       console.log("[Identify] Scraper result:", {
         title: scrapedRaw.title,
         brand: scrapedRaw.brand,
         price: scrapedRaw.price,
         priceReliable: scrapedRaw.priceReliable,
         isExactMatch: scrapedRaw.isExactMatch,
         matchType: scrapedRaw.matchType,
         matchValidation: scrapedRaw.matchValidation,
         scraperSource: scrapedRaw.scraperSource,
       });
     }
     step = logStep("Scraper race complete", scrapeStart);

     const scraperTitle = String(scrapedRaw?.title ?? "").trim();

     if (!scraperHasUsableProduct(scrapedRaw)) {
       console.warn(
         "[Identify] No valid marketplace product — vision fallback with estimated pricing"
       );
       listings = applyScrapeMeta(buildVisionFallback(vision), scrapedRaw);
     } else {
       console.log(
         `[Identify] mergeVisionAndScraper — vision: title="${vision.title}" | scraper: title="${scraperTitle}" price=${scrapedRaw!.price} priceReliable=${scrapedRaw!.priceReliable}`
       );
       listings = applyScrapeMeta(
         mergeVisionAndScraper(vision, scrapedRaw!),
         scrapedRaw
       );
     }

     if (listings.scraperSource) {
       console.log("[Identify] Scraper source:", listings.scraperSource);
     }
     if (listings.verificationWarning) {
       console.warn("[Identify] Verification:", listings.verificationWarning);
     }
     if (listings.timedOut) {
       console.warn("[Identify] One or more scrapers timed out");
     }
   }

   console.log("[Identify] Final listing price:", {
     price: listings.price,
     priceReliable: listings.priceReliable,
     isExactMatch: listings.isExactMatch,
     matchType: listings.matchType,
     category: listings.category,
   });

   console.log("📦 Listing result:", JSON.stringify(listings, null, 2));

   // ✨ NEW: Save as a draft in the database
   const draftData = {
     title: listings.title ?? searchQuery,
     sku: listings.refNumber || `AUTO-${Date.now()}`,
     status: 'ready_for_posting', // This makes it appear on page 3
     images: [`data:${req.file.mimetype};base64,${base64Image}`],
     attributes: {
       brand: normalizeBrand(listings.brand) || normalizeBrand(vision.brand),
       model: String(listings.model ?? "").trim(),
       year: listings.year || new Date().getFullYear().toString(),
       condition:
         normalizeCondition(listings.condition) ||
         normalizeCondition(vision.condition) ||
         "Used",
       material: String(listings.material ?? vision.material ?? "").trim(),
       color: String(listings.color ?? vision.color ?? "").trim(),
       style: String(vision.style ?? "").trim(),
       aiDescription: listings.description || `KAUF-AI identified as: ${searchQuery}`,
       longDescription:
         listings.longDescription ||
         listings.description ||
         `KAUF-AI identified as: ${searchQuery}`,
       priceReliable: listings.priceReliable === true,
       medianPrice: String(listings.medianPrice ?? listings.price ?? "0.00"),
       marketPrices: {
         allegroAvg: String(listings.allegroAvg ?? listings.price ?? "0.00"),
         ebayAvg: String(listings.ebayAvg ?? listings.ebayPrice ?? "0.00"),
         recommendedPrice: String(listings.price ?? "0.00"),
       },
       source: listings.scraperSource ?? "ai_identified",
       matchType: listings.matchType ?? "generic",
       isExactMatch: listings.isExactMatch === true,
       scraperSource: listings.scraperSource ?? null,
       scraperMetadata: listings._scraperMetadata ?? null,
       requiresManualReview: listings.requiresManualReview === true,
       priceMin: String(listings.priceMin ?? ""),
       priceMax: String(listings.priceMax ?? ""),
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
   const draftId = savedDraft.id ?? savedDraft;
   console.log("✅ Draft saved successfully with ID:", draftId);

   const publishJobId = await prepareDraftPublishing(Number(draftId));

   // Normalized response for ProductDraft / sessionStorage (Task A)
   const capturedImage = `data:${req.file.mimetype};base64,${base64Image}`;
   const market = fillMarketAverages({
     price: listings.price ?? 0,
     allegroAvg: listings.allegroAvg ?? listings.price,
     ebayAvg: listings.ebayAvg ?? listings.ebayPrice,
   });

   const matchType: MatchType = listings.matchType ?? "generic";
   const isExactMatch = matchType === "exact";

   logStep("Identify total", identifyStart);

   res.json({
     success: true,
     draftId,
     publishJobId,
     requiresManualReview: listings.requiresManualReview === true,
     priceMin: listings.priceMin ?? null,
     priceMax: listings.priceMax ?? null,
     isExactMatch,
     matchType,
     visionConfidence: vision.confidence,
     matchConfidence: listings.matchConfidence ?? "low",
     matchScore: listings.matchScore ?? 0,
     timedOut: listings.timedOut === true,
     confidence: listings.matchConfidence ?? "low",
     scraperSource: listings.scraperSource ?? null,
     scraperMetadata: listings._scraperMetadata ?? null,
     verificationWarning: listings.verificationWarning ?? null,
     product: {
       title: listings.title ?? searchQuery,
       description: listings.description ?? vision.description ?? "",
       longDescription:
         listings.longDescription ??
         listings.description ??
         vision.description ??
         "",
       price: String(market.price),
       priceReliable: listings.priceReliable === true,
       medianPrice: String(listings.medianPrice ?? market.price),
       brand: normalizeBrand(listings.brand) || normalizeBrand(vision.brand),
       model: String(listings.model ?? "").trim(),
       category: coalesceCategory(listings.category, vision.category),
       condition:
         normalizeCondition(listings.condition) ||
         normalizeCondition(vision.condition) ||
         "Used",
       material: String(listings.material ?? vision.material ?? "").trim(),
       color: String(listings.color ?? vision.color ?? "").trim(),
       style: String(listings.style ?? vision.style ?? "").trim(),
       allegroAvg: market.allegroAvg,
       ebayAvg: market.ebayAvg,
       capturedImage,
       isExactMatch,
       matchType,
       scraperSource: listings.scraperSource,
       matchConfidence: listings.matchConfidence,
     },
   });
}

// -------------------- IDENTIFY ROUTE (image -> scrape -> save to drafts) --------------------
app.post(
  "/api/identify",
  (req, res, next) => {
    const httpTimeout = Math.max(
      IDENTIFY_REQUEST_TIMEOUT_MS,
      IDENTIFY_JOB_TIMEOUT_MS + 2_000
    );
    req.setTimeout(httpTimeout);
    res.setTimeout(httpTimeout);
    next();
  },
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      await enqueueIdentifyJob(() => runIdentifyPipeline(req, res));
    } catch (error) {
      if (res.headersSent) return;
      if (error instanceof IdentifyJobTimeoutError) {
        console.warn("[Identify] Queue job timeout:", error.message);
        return res.status(504).json({
          error: "Gateway Timeout",
          message: `Identification exceeded ${IDENTIFY_JOB_TIMEOUT_MS}ms — try again`,
        });
      }
      console.error("❌ Identification Error:", error);
      res.status(500).json({ error: "Scraping or identification failed" });
    }
  }
);

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