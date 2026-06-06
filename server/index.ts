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
import {
  detectLuxuryProfile,
  isPriceSaneForLuxury,
  type LuxuryProfile,
} from "./scrapers/luxuryPricing";
import { extractBrandModelFromTitle } from "./scrapers/googleSearchApify";
import { debugIdentify } from "./scrapers/scrapeDebug";
import { MAX_PRODUCT_PAGE_IMAGES } from "./scrapers/productPageImages";
import { extractReferenceNumbers } from "./scrapers/visionMatch";
import { stripExternalUrlFields } from "./listingSanitizer";
import { SUPPORTED_MARKETPLACE_IDS } from "./publishToMarketplaces";
import { productRoutes } from "./productsRoutes";
import marketplaceRoutes from "./marketplaceRoutes";
import inventoryRoutes from "./inventoryRoutes";
import { startInventoryPoller } from "./inventoryPoller";
import { startMarketplaceWorker } from "./marketplaceWorker";
import {
  enqueueIdentifyJob,
  IdentifyJobTimeoutError,
  IDENTIFY_JOB_TIMEOUT_MS,
} from "./identifyQueue";
import {
  logVisionMergeSources,
  mergeVisionResults,
  type VisionConfidence,
  type VisionPerImage,
  type VisionProduct,
} from "./visionMerge";

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

type MatchType = "exact" | "similar" | "generic";

type IdentifyImageInput = {
  buffer: Buffer;
  mimetype: string;
};

const MAX_IDENTIFY_IMAGES = 3;

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
  listingCount?: number;
  exactMatchCount?: number;
  imageUrls?: string[];
  primaryImageUrl?: string;
};

function mergeDraftImages(
  captured: string[],
  pageUrls: string[] | undefined
): string[] {
  const merged = [...captured];
  for (const url of pageUrls ?? []) {
    if (merged.length >= MAX_PRODUCT_PAGE_IMAGES) break;
    if (!merged.includes(url)) merged.push(url);
  }
  return merged.slice(0, MAX_PRODUCT_PAGE_IMAGES);
}

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

function scraperHasUsableProduct(
  scraped: ScrapedListing | null,
  vision?: VisionProduct
): boolean {
  if (!scraped) return false;
  const price = parseFloat(String(scraped.price ?? 0)) || 0;
  const exact =
    scraped.isExactMatch === true || scraped.matchType === "exact";
  if (!exact) return false;

  const luxury = detectLuxuryProfile(
    vision?.brand,
    vision?.title,
    scraped.title,
    scraped.brand
  );
  if (luxury?.isLuxuryWatch) {
    return isPriceSaneForLuxury(price, luxury) || price === 0;
  }
  return price >= 5;
}

function buildVisionFallback(vision: VisionProduct): ScrapedListing {
  const range = getFallbackPriceRange(
    vision.category,
    vision.title,
    vision.brand
  );
  const listing = stripListingUrls({
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
      "Product identified, but pricing information is incomplete. Please review before posting.",
  });
  enrichBrandModelFromScraper(
    listing,
    { title: vision.title, brand: vision.brand } as ScrapedListing,
    vision
  );
  return listing;
}

const ICONIC_WATCH_MODEL_RE =
  /\b(submariner(?:\s+date)?|daytona|datejust|speedmaster|seamaster|royal\s+oak|nautilus)\b/i;

function enrichBrandModelFromScraper(
  final: ScrapedListing,
  scraper: ScrapedListing,
  vision: VisionProduct
): void {
  const hint =
    normalizeBrand(final.brand) ||
    normalizeBrand(vision.brand) ||
    normalizeBrand(scraper.brand);
  const parsed = extractBrandModelFromTitle(
    String(scraper.title ?? final.title ?? ""),
    hint
  );

  final.brand = hint || normalizeBrand(parsed.brand);
  if (!String(final.model ?? "").trim()) {
    final.model = String(scraper.model ?? parsed.model ?? "").trim();
  }
  if (!final.model) {
    const iconic = String(scraper.title ?? final.title ?? "").match(
      ICONIC_WATCH_MODEL_RE
    );
    if (iconic?.[1]) final.model = iconic[1];
  }
  if (!final.refNumber) {
    const refs = extractReferenceNumbers(
      [
        scraper.title,
        scraper.description,
        scraper.longDescription,
        final.title,
      ]
        .filter(Boolean)
        .join(" ")
    );
    if (refs[0]) final.refNumber = refs[0];
  }
}

function resolveScraperPrice(
  scraper: ScrapedListing,
  luxury: LuxuryProfile | null
): number {
  let price =
    parseFloat(String(scraper.medianPrice ?? scraper.price ?? 0)) || 0;
  if (luxury?.isLuxuryWatch && price > 0 && price < luxury.minSanityPrice) {
    const alt = parseFloat(String(scraper.medianPrice ?? 0)) || 0;
    price =
      alt >= luxury.minSanityPrice ? alt : luxury.fallbackSuggested;
  }
  return price;
}

/** Vision-first merge: preserve vision detail fields; scraper wins title/brand/model on exact match */
function mergeVisionAndScraper(
  vision: VisionProduct,
  scraper: ScrapedListing
): ScrapedListing {
  const final: ScrapedListing = visionToListing(vision);

  // Never strip vision physical attributes
  final.material = String(vision.material ?? scraper.material ?? "").trim();
  final.color = String(vision.color ?? scraper.color ?? "").trim();
  final.style = String(vision.style ?? scraper.style ?? "").trim();
  final.year = String(scraper.year ?? "").trim() || undefined;
  final.refNumber = String(scraper.refNumber ?? "").trim() || undefined;
  final.description = truncateWords(
    String(vision.description ?? scraper.description ?? "").trim(),
    50
  );

  const scraperExact =
    scraper.isExactMatch === true || scraper.matchType === "exact";

  const override = canScraperOverrideVision({
    visionTitle: vision.title,
    visionBrand: vision.brand,
    visionMaterial: vision.material,
    visionColor: vision.color,
    visionStyle: vision.style,
    scraperTitle: String(scraper.title ?? ""),
    scraperBrand: scraper.brand,
    price: scraper.medianPrice ?? scraper.price,
    description: scraper.description,
    url: scraper.url ?? scraper.link ?? scraper.productUrl,
    isExactMatch: scraperExact,
  });

  const luxury = override.luxuryProfile;

  if (override.allowed) {
    final.title = String(scraper.title ?? vision.title).trim();
    final.brand =
      normalizeBrand(scraper.brand) || normalizeBrand(vision.brand);
    final.model = String(scraper.model ?? "").trim();
    final.isExactMatch = true;
    final.matchType = "exact";
    final.requiresManualReview = false;
    console.log(
      `[Identify] Scraper exact match — keeping scraper title/brand tokenMatch=${override.tokenMatch.toFixed(2)} coverage=${override.tokenCoverage.toFixed(2)} title="${final.title}"`
    );
  } else if (override.reasons.length > 0) {
    console.log(
      `[Identify] Scraper override blocked: ${override.reasons.join(", ")}`
    );
    if (scraperExact && luxury?.isLuxuryWatch) {
      final.requiresManualReview = true;
    } else if (!scraperExact) {
      final.requiresManualReview = true;
    }
  }

  const scrapedPrice = resolveScraperPrice(scraper, luxury);
  const priceOk =
    luxury?.isLuxuryWatch
      ? isPriceSaneForLuxury(scrapedPrice, luxury)
      : scrapedPrice >= 5;

  if (priceOk && (scraper.priceReliable === true || scraperExact)) {
    final.price = scrapedPrice;
    final.medianPrice =
      parseFloat(String(scraper.medianPrice ?? scrapedPrice)) || scrapedPrice;
    final.priceReliable =
      scraper.priceReliable === true ||
      (luxury?.isLuxuryWatch === true && override.allowed);
    final.allegroAvg =
      parseFloat(String(scraper.allegroAvg ?? scrapedPrice)) || scrapedPrice;
    final.ebayAvg =
      parseFloat(
        String(scraper.ebayAvg ?? scraper.ebayPrice ?? scrapedPrice)
      ) || scrapedPrice;
    if (scraper.priceMin != null) final.priceMin = scraper.priceMin;
    if (scraper.priceMax != null) final.priceMax = scraper.priceMax;
    if (!override.allowed) final.requiresManualReview = true;
  } else if (luxury?.isLuxuryWatch && scraperExact) {
    final.price = luxury.fallbackSuggested;
    final.medianPrice = luxury.fallbackSuggested;
    final.priceMin = luxury.fallbackMin;
    final.priceMax = luxury.fallbackMax;
    final.priceReliable = false;
    final.requiresManualReview = true;
    final.verificationWarning =
      "Luxury watch detected but marketplace price looked unreliable — using market estimate. Review before posting.";
  }

  const scraperLong = String(scraper.longDescription ?? "").trim();
  final.longDescription =
    scraperLong || String(vision.description ?? "").trim();

  final._scraperMetadata = {
    source: scraper.scraperSource ?? null,
    matchValidation: scraper.matchValidation ?? null,
  };

  if (!override.allowed && scraper.matchType === "similar") {
    final.matchType = "similar";
  }

  enrichBrandModelFromScraper(final, scraper, vision);

  if (
    scraperExact &&
    luxury?.isLuxuryWatch &&
    priceOk &&
    !override.allowed &&
    override.tokenCoverage >= 0.75 &&
    String(scraper.title ?? "").length > String(vision.title ?? "").length
  ) {
    final.title = String(scraper.title).trim();
    final.isExactMatch = true;
    final.matchType = "exact";
    console.log(
      `[Identify] Luxury exact — keeping detailed scraper title coverage=${override.tokenCoverage.toFixed(2)} title="${final.title}"`
    );
  }

  final.matchValidation = scraper.matchValidation;
  final.scraperSource = scraper.scraperSource;

  debugIdentify("mergeVisionAndScraper", {
    visionTitle: vision.title,
    visionBrand: vision.brand,
    scraperTitle: scraper.title,
    scraperBrand: scraper.brand,
    scraperPrice: scraper.price,
    medianPrice: scraper.medianPrice,
    overrideAllowed: override.allowed,
    overrideReasons: override.reasons,
    tokenMatch: override.tokenMatch,
    tokenCoverage: override.tokenCoverage,
    luxuryBrand: luxury?.brand ?? null,
    finalTitle: final.title,
    finalBrand: final.brand,
    finalModel: final.model,
    finalPrice: final.price,
    refNumber: final.refNumber ?? null,
    preservedMaterial: final.material,
    preservedColor: final.color,
    preservedStyle: final.style,
  });

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

function dataUrlToImageBuffer(
  dataUrl: string
): IdentifyImageInput | null {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return {
      mimetype: match[1],
      buffer: Buffer.from(match[2], "base64"),
    };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return {
      mimetype: "image/jpeg",
      buffer: Buffer.from(trimmed.replace(/\s/g, ""), "base64"),
    };
  }
  return null;
}

function extractIdentifyImages(req: Request): IdentifyImageInput[] {
  const files = req.files as
    | {
        image?: Express.Multer.File[];
        images?: Express.Multer.File[];
      }
    | undefined;

  const fromMulter: IdentifyImageInput[] = [];
  if (files?.image?.[0]) {
    fromMulter.push({
      buffer: files.image[0].buffer,
      mimetype: files.image[0].mimetype || "image/jpeg",
    });
  }
  if (files?.images?.length) {
    for (const file of files.images) {
      fromMulter.push({
        buffer: file.buffer,
        mimetype: file.mimetype || "image/jpeg",
      });
    }
  }
  if (fromMulter.length > 0) {
    return fromMulter.slice(0, MAX_IDENTIFY_IMAGES);
  }

  const body = req.body as { image?: string; images?: string[] };
  if (Array.isArray(body.images)) {
    const parsed = body.images
      .slice(0, MAX_IDENTIFY_IMAGES)
      .map((entry) => dataUrlToImageBuffer(String(entry ?? "")))
      .filter((entry): entry is IdentifyImageInput => entry != null);
    if (parsed.length > 0) return parsed;
  }
  if (body.image) {
    const single = dataUrlToImageBuffer(String(body.image));
    return single ? [single] : [];
  }
  return [];
}

function toDataUrl(image: IdentifyImageInput): string {
  const mime = image.mimetype || "image/jpeg";
  return `data:${mime};base64,${image.buffer.toString("base64")}`;
}

async function callVisionForImage(
  image: IdentifyImageInput,
  imageIndex: number
): Promise<VisionPerImage | null> {
  const base64Image = image.buffer.toString("base64");
  console.log(
    `🤖 [Vision] Image ${imageIndex + 1}: calling OpenAI (max ${VISION_TIMEOUT_MS}ms)...`
  );

  const visionResponse = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_IDENTIFY_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mimetype || "image/jpeg"};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), VISION_TIMEOUT_MS)
    ),
  ]);

  if (!visionResponse) {
    console.warn(
      `[Identify] Vision timed out for image ${imageIndex + 1} after ${VISION_TIMEOUT_MS}ms`
    );
    return null;
  }

  const visionRaw = visionResponse.choices[0].message.content || "";
  console.log(`🔬 [Vision] Image ${imageIndex + 1} raw:`, visionRaw);
  const parsed = parseVisionResponse(visionRaw);
  if (!parsed?.title?.trim()) {
    console.warn(
      `[Identify] Vision could not identify product from image ${imageIndex + 1}`
    );
    return null;
  }

  return { ...parsed, imageIndex };
}

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
    year: String(listing.year ?? "").trim() || undefined,
    refNumber: String(listing.refNumber ?? "").trim() || undefined,
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

// Central inventory pool (shared quantity across marketplace listings)
app.use("/api/inventory", inventoryRoutes);

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
 const logStep = (label: string, since: number) => {
   console.log(`[Identify] ${label}: ${Date.now() - since}ms`);
   return Date.now();
 };
 let step = identifyStart;

   const imageInputs = extractIdentifyImages(req);
   const totalBytes = imageInputs.reduce((sum, img) => sum + img.buffer.length, 0);

   console.log(
     "📸 [1/5] Images received:",
     imageInputs.length,
     "total bytes:",
     totalBytes
   );

   if (imageInputs.length === 0) {
     console.log("❌ No images in request");
     res.status(400).json({
       error: "No image uploaded",
       message:
         "Send multipart field `image` or `images[]`, or JSON { image } / { images: [] }",
     });
     return;
   }

   console.log(
     `🤖 [2/5] Calling OpenAI vision for ${imageInputs.length} image(s) (max ${VISION_TIMEOUT_MS}ms each, parallel)...`
   );
   const visionStart = Date.now();
   const visionResults = await Promise.all(
     imageInputs.map((image, index) => callVisionForImage(image, index))
   );
   step = logStep("Vision complete", visionStart);

   const perImageVision = visionResults.filter(
     (result): result is VisionPerImage => result != null
   );

   if (perImageVision.length === 0) {
     console.warn("❌ Vision could not identify product from any image");
     res.status(422).json({
       message:
         "Could not identify product – please try again with better lighting",
     });
     return;
   }

   const {
     vision,
     sources: visionSources,
     primaryImageIndex,
   } = mergeVisionResults(perImageVision);
   logVisionMergeSources(
     perImageVision,
     visionSources,
     vision,
     primaryImageIndex
   );

   const primaryImage =
     imageInputs[primaryImageIndex] ?? imageInputs[0];
   const base64Image = primaryImage.buffer.toString("base64");
   const allImageDataUrls = imageInputs.map(toDataUrl);

   const searchQuery = vision.title;
   console.log("🔍 [3/5] Merged vision:", JSON.stringify(vision, null, 2));

   let listings: ScrapedListing;
   let fallbackToVision = false;
   let listingsFound = 0;
   let scrapedRaw: ScrapedListing | null = null;

   {
     console.log("🕸️ [4/5] Calling scraper with query:", searchQuery);
     const scrapeStart = Date.now();
     try {
       scrapedRaw = (await fetchMasterProductData(searchQuery, {
         vision: {
           visionTitle: vision.title,
           visionBrand: vision.brand ?? "",
         },
         imageBase64: base64Image,
         imageMimeType: primaryImage.mimetype || "image/jpeg",
       })) as ScrapedListing | null;
     } catch (scraperErr) {
       console.warn(
         "[Identify] Scraper error — continuing with vision-only draft:",
         scraperErr instanceof Error ? scraperErr.message : scraperErr
       );
       scrapedRaw = null;
     }
     step = logStep("Scraper race complete", scrapeStart);

     listingsFound = Number(
       scrapedRaw?.listingCount ??
         scrapedRaw?.exactMatchCount ??
         (scraperHasUsableProduct(scrapedRaw, vision) ? 1 : 0)
     );

     if (!scrapedRaw) {
       console.warn("[Identify] Scraper returned no result — vision-only draft");
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
         listingsFound,
       });
     }

     const scraperTitle = String(scrapedRaw?.title ?? "").trim();

     if (!scraperHasUsableProduct(scrapedRaw, vision)) {
       fallbackToVision = true;
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

   const requiresManualReview =
     fallbackToVision || listings.requiresManualReview === true;
   const draftStatus = requiresManualReview
     ? "requires_review"
     : "ready_for_posting";

   const pageImageUrls = Array.isArray(listings.imageUrls)
     ? listings.imageUrls.filter((u): u is string => typeof u === "string")
     : [];
   const draftImages = mergeDraftImages(allImageDataUrls, pageImageUrls);

   const draftData = {
     title: listings.title ?? searchQuery,
     sku: listings.refNumber || `AUTO-${Date.now()}`,
     status: draftStatus,
     images: draftImages,
     attributes: {
       brand: normalizeBrand(listings.brand) || normalizeBrand(vision.brand),
       model: String(listings.model ?? "").trim(),
       referenceNumber: String(listings.refNumber ?? "").trim(),
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
       requiresManualReview,
       fallbackToVision,
       listingsFound,
       priceMin: String(listings.priceMin ?? ""),
       priceMax: String(listings.priceMax ?? ""),
       identifiedAt: new Date().toISOString(),
       imagesProcessed: imageInputs.length,
       visionSources,
       productPageImageUrls: pageImageUrls,
       productPageImageCount: pageImageUrls.length,
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

   const publishJobId = requiresManualReview
     ? null
     : await prepareDraftPublishing(Number(draftId));

   // Normalized response for ProductDraft / sessionStorage (Task A)
   const capturedImage = draftImages[0] ?? allImageDataUrls[0];
   const market = fillMarketAverages({
     price: listings.price ?? 0,
     allegroAvg: listings.allegroAvg ?? listings.price,
     ebayAvg: listings.ebayAvg ?? listings.ebayPrice,
   });

   const matchType: MatchType = listings.matchType ?? "generic";
   const isExactMatch = matchType === "exact";
   const priceReliable = listings.priceReliable === true && !fallbackToVision;
   const responsePrice = priceReliable
     ? market.price
     : null;

   logStep("Identify total", identifyStart);

   res.json({
     success: true,
     draftId,
     imagesProcessed: imageInputs.length,
     sources: visionSources,
     publishJobId,
     message: requiresManualReview
       ? "Product identified, but pricing information is incomplete. Please review before posting."
       : undefined,
     requiresManualReview,
     fallbackToVision,
     listingsFound,
     price: responsePrice,
     priceReliable,
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
       price: priceReliable
         ? String(market.price)
         : String(listings.medianPrice ?? listings.price ?? ""),
       priceReliable,
       medianPrice: String(listings.medianPrice ?? market.price),
       brand: normalizeBrand(listings.brand) || normalizeBrand(vision.brand),
       model: String(listings.model ?? "").trim(),
       referenceNumber: String(listings.refNumber ?? "").trim(),
       year: String(listings.year ?? "").trim() || undefined,
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
       capturedImages: allImageDataUrls,
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
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: MAX_IDENTIFY_IMAGES },
  ]),
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
      res.status(500).json({
        error: "Identification failed",
        message:
          error instanceof Error
            ? error.message
            : "Identification failed — please try again",
      });
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
   console.log(`   - POST /api/identify (1–3 images → OpenAI vision merge → scrape → draft)`);
   console.log(`   - POST /api/catalog/scrape (JSON { query } → masterScraper)`);
   console.log(`   - GET  /api/health`);
   console.log(`   - GET/POST /api/drafts (productsRoutes → PostgreSQL)`);
   console.log(`   - GET  /api/drafts/ready-for-posting`);
   console.log(`   - POST /api/drafts/:id/post-to-marketplaces`);
   console.log(`   - POST /api/products/save`);
   console.log(`   - POST /api/create-checkout-session`);
   console.log(`   - POST /api/create-hold`);
   console.log(`   - POST /api/marketplaces/publish`);
   console.log(`   - POST /api/marketplaces/publish-all`);
   console.log(`   - GET  /api/marketplaces/status/:jobId`);
   console.log(`   - GET  /api/inventory/draft/:draftId`);
   console.log(`   - PUT  /api/inventory/draft/:draftId/quantity`);
   console.log(`   - POST /api/inventory/webhooks/:marketplace`);
   startMarketplaceWorker();
   startInventoryPoller();
 });
})();