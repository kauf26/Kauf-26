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
import { extractBrandModelFromTitle } from "./scrapers/brandFromTitle";
import {
  coalesceBrandWithTitle,
  titleParsedBrandIsModelName,
  validateBrandTitleConsistency,
} from "./scrapers/listingUtils";
import { debugIdentify } from "./scrapers/scrapeDebug";
import {
  computeIdentificationWarnings,
  logIdentifyPipelineStage,
  normalizeIdentificationCondition,
  resolveFinalBrand,
  resolveFinalTitle,
  resolveScraperUsage,
  shouldRejectScraperProduct,
  shouldUseScraperPricing,
  type IdentificationWarnings,
} from "./services/identifyMergeService";
import {
  prepareImageForVision,
  USER_QUALITY_ERROR,
  type ImageQualityReport,
} from "./services/imageQualityService";
import {
  createCallVisionForImage,
  VISION_IDENTIFY_PROMPT,
  type VisionCallMeta,
} from "./services/visionService";
import { MAX_DRAFT_IMAGES } from "../shared/draftImages";
import { extractReferenceNumbers } from "./scrapers/visionMatch";
import { stripExternalUrlFields } from "./listingSanitizer";
import { SUPPORTED_MARKETPLACE_IDS } from "./publishToMarketplaces";
import { productRoutes } from "./productsRoutes";
import { dashboardDataRoutes } from "./dashboardDataRoutes";
import { shippingRoutes } from "./shippingRoutes";
import { marketplaceOAuthRoutes } from "./marketplaceOAuthRoutes";
import { registerMarketplaceAuthRoutes } from "./authMarketplaceRoutes";
import { LABELS_DIR, ensureLabelsDir } from "./services/shippingLabelService";
import marketplaceRoutes from "./marketplaceRoutes";
import inventoryRoutes from "./inventoryRoutes";
import analyticsRoutes from "./analyticsRoutes";
import { setupAuth, registerAuthRoutes } from "./auth";
import onboardingRoutes from "./onboardingRoutes";
import { startInventoryPoller } from "./inventoryPoller";
import { startMarketplaceWorker } from "./marketplaceWorker";
import {
  enqueueIdentifyJob,
  IdentifyJobTimeoutError,
  IDENTIFY_JOB_TIMEOUT_MS,
  runVisionPhase,
  VisionIdentifyError,
  type IdentifyJobData,
} from "./identifyQueue";
import { ensureUploadsDir, UPLOADS_DIR } from "./services/draftPhotoUpload";
import {
  extractIdentifyImages,
  MAX_IDENTIFY_IMAGES,
  parseIdentifyOptions,
  toDataUrl,
  type IdentifyImageInput,
} from "./identifyImages";
import {
  verifyEbayConnection,
  type MarketplaceConnectionResult,
} from "./services/ebayApi";
import { verifyEtsyConnection } from "./services/etsyApi";
import { verifyShopifyConnection } from "./services/shopifyApi";
import { getAllMarketplaceOAuthConfigs, getMarketplaceOAuthConfigs } from "./config/oauthConfig";
import {
  type VisionConfidence,
  type VisionPerImage,
  type VisionProduct,
  buildScraperSearchQuery,
} from "./visionMerge";
import {
  checkTranslationServiceHealth,
  resolveTranslationTargetLanguage,
  translateText,
  translateVisionListingFields,
  type VisionTranslationResult,
} from "./services/translationService";

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

function normalizeCondition(condition: unknown, brand?: string): string {
  return normalizeIdentificationCondition(condition, brand);
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
    if (merged.length >= MAX_DRAFT_IMAGES) break;
    if (!merged.includes(url)) merged.push(url);
  }
  return merged.slice(0, MAX_DRAFT_IMAGES);
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
  if (vision && shouldRejectScraperProduct(vision, scraped)) {
    console.warn(
      `[Identify] Scraper product rejected — brand conflict with vision (vision="${vision.brand ?? ""}" scraper="${scraped.brand ?? ""}" title="${scraped.title ?? ""}")`
    );
    return false;
  }
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
  if (shouldRejectScraperProduct(vision, scraper)) {
    final.brand = normalizeBrand(vision.brand) || normalizeBrand(final.brand);
    final.title = resolveFinalTitle(vision, scraper, String(final.title ?? ""));
    if (!String(final.model ?? "").trim() && vision.model) {
      final.model = String(vision.model).trim();
    }
    return;
  }

  const titleForParse = String(final.title ?? scraper.title ?? "");
  const brandOpts = {
    visionModel: String(vision.model ?? "").trim(),
    listingModel: String(scraper.model ?? final.model ?? "").trim(),
  };
  const coalesced = coalesceBrandWithTitle(
    titleForParse,
    scraper.brand ?? final.brand,
    vision.brand,
    brandOpts
  );
  const parsed = extractBrandModelFromTitle(titleForParse);

  final.brand =
    coalesced.brand ||
    normalizeBrand(scraper.brand) ||
    normalizeBrand(vision.brand) ||
    (titleParsedBrandIsModelName(parsed.brand, brandOpts)
      ? ""
      : normalizeBrand(parsed.brand));
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
    visionBrandConfidence: vision.brandConfidence ?? vision.confidence,
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
    const brandFromTitle = coalesceBrandWithTitle(
      final.title,
      scraper.brand,
      vision.brand,
      { visionModel: vision.model, listingModel: scraper.model }
    );
    final.brand = brandFromTitle.brand;
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
  const scraperRejected = shouldRejectScraperProduct(vision, scraper);
  const useScraperPricing = shouldUseScraperPricing(
    vision,
    scraper,
    override.allowed,
    luxury
  );

  if (useScraperPricing && (scraper.priceReliable === true || scraperExact)) {
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
  } else if (luxury?.isLuxuryWatch && (scraperExact || scraperRejected)) {
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
    useScraperPricing &&
    !override.allowed &&
    override.tokenCoverage >= 0.75 &&
    String(scraper.title ?? "").length > String(vision.title ?? "").length
  ) {
    final.title = String(scraper.title).trim();
    const brandFromTitle = coalesceBrandWithTitle(
      final.title,
      scraper.brand,
      vision.brand,
      { visionModel: vision.model, listingModel: scraper.model }
    );
    final.brand = brandFromTitle.brand;
    final.isExactMatch = true;
    final.matchType = "exact";
    console.log(
      `[Identify] Luxury exact — keeping detailed scraper title coverage=${override.tokenCoverage.toFixed(2)} title="${final.title}" brand="${final.brand}"`
    );
  }

  const finalBrandCheck = coalesceBrandWithTitle(
    String(final.title ?? ""),
    scraper.brand ?? final.brand,
    vision.brand,
    { visionModel: vision.model, listingModel: scraper.model ?? final.model }
  );
  final.brand = resolveFinalBrand(vision, scraper, finalBrandCheck.brand);
  final.title = resolveFinalTitle(vision, scraper, String(final.title ?? ""));
  final.condition = normalizeCondition(final.condition, final.brand);
  validateBrandTitleConsistency(
    String(final.title ?? ""),
    String(final.brand ?? ""),
    "mergeVisionAndScraper"
  );

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
    brandSource: finalBrandCheck.source,
    finalModel: final.model,
    finalPrice: final.price,
    refNumber: final.refNumber ?? null,
    preservedMaterial: final.material,
    preservedColor: final.color,
    preservedStyle: final.style,
    scraperRejected,
    useScraperPricing,
  });

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

function inferModelFromTitle(title: string, brand: string): string {
  const t = title.trim();
  const b = brand.trim();
  if (!t) return "";
  if (b) {
    const lower = t.toLowerCase();
    const brandLower = b.toLowerCase();
    if (lower.startsWith(brandLower)) {
      return t.slice(b.length).trim();
    }
  }
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
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
    const brand = parsed.brand?.trim() || "";
    const model =
      String(parsed.model ?? "").trim() ||
      inferModelFromTitle(title, brand);

    return {
      title,
      brand: confidence === "low" && brand ? "" : brand,
      model,
      category: coalesceCategory(categoryFromVision),
      condition: normalizeCondition(parsed.condition, brand),
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
    brand: shouldRejectScraperProduct(vision, listing)
      ? normalizeBrand(vision.brand)
      : normalizeBrand(listing.brand) || normalizeBrand(vision.brand),
    model: String(listing.model ?? vision.model ?? "").trim(),
    year: String(listing.year ?? "").trim() || undefined,
    refNumber: String(listing.refNumber ?? "").trim() || undefined,
    category,
    material: String(listing.material ?? vision.material ?? "").trim(),
    color: String(listing.color ?? vision.color ?? "").trim(),
    style: String(listing.style ?? vision.style ?? "").trim(),
    condition:
      normalizeCondition(listing.condition, listing.brand ?? vision.brand) ||
      normalizeCondition(vision.condition, vision.brand) ||
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
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

void ensureUploadsDir().catch((err) => {
  console.warn("[KAUF26] Could not create uploads directory:", err);
});
void ensureLabelsDir().catch((err) => {
  console.warn("[KAUF26] Could not create labels directory:", err);
});
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/uploads/labels", express.static(LABELS_DIR));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

// Listings, sales, dashboard layout
app.use("/api", dashboardDataRoutes);

// Shipping label maker
app.use("/api/shipping", shippingRoutes);

// Marketplace publish queue (POST /api/marketplaces/publish, GET /api/marketplaces/status/:jobId)
app.use("/api/marketplaces", marketplaceRoutes);

// Central inventory pool (shared quantity across marketplace listings)
app.use("/api/inventory", inventoryRoutes);

// Marketplace analytics dashboards
app.use("/api/analytics", analyticsRoutes);

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

/** Vision on all images → merge → scraper → draft save (runs inside identify queue). */
async function runIdentifyPipeline(
  job: IdentifyJobData,
  res: Response
): Promise<void> {
 const identifyStart = Date.now();
 const logStep = (label: string, since: number) => {
   console.log(`[Identify] ${label}: ${Date.now() - since}ms`);
   return Date.now();
 };
 let step = identifyStart;

   const imageInputs = job.images;
   const totalBytes = imageInputs.reduce((sum, img) => sum + img.buffer.length, 0);

   console.log(
     "📸 [1/5] Images received:",
     imageInputs.length,
     "total bytes:",
     totalBytes
   );

   console.log(
     `🤖 [2/5] Calling OpenAI vision for ${imageInputs.length} image(s) (max ${VISION_TIMEOUT_MS}ms each, parallel) — scraper starts only after aggregation...`
   );
   const visionStart = Date.now();
   let visionPhase;
   try {
     visionPhase = await runVisionPhase(job, callVisionForImage);
   } catch (err) {
     if (err instanceof VisionIdentifyError) {
       console.warn("❌ Vision could not identify product from any image");
       res.status(422).json({
         message:
           "Could not identify product – please try again with better lighting",
       });
       return;
     }
     throw err;
   }
   step = logStep("Vision aggregate complete", visionStart);

   const {
     vision: mergedVision,
     sources: visionSources,
     primaryImageIndex,
     searchQuery: initialSearchQuery,
     perImage: perImageVision,
   } = visionPhase;

   let vision = mergedVision;
   let searchQuery = initialSearchQuery;
   let translationResult: VisionTranslationResult | null = null;

   if (job.autoTranslate) {
     const targetLang = resolveTranslationTargetLanguage({
       marketplaceIds: job.marketplaceIds,
       targetLang: job.targetLang,
     });
     if (targetLang && targetLang !== "en") {
       console.log(
         `🌐 [3/5] Translating listing fields → ${targetLang} (marketplaces=${(job.marketplaceIds ?? []).join(",") || "default"})`
       );
       translationResult = await translateVisionListingFields(vision, {
         targetLang,
         sourceLang: "en",
       });
       if (translationResult.applied) {
         vision = translationResult.vision;
         searchQuery = buildScraperSearchQuery(vision);
         console.log(
           `[Identify] Translated title="${vision.title}" searchQuery="${searchQuery}"`
         );
       } else if (translationResult.error) {
         console.warn(
           `[Identify] Translation skipped: ${translationResult.error}`
         );
       }
     }
   }

   const primaryImage =
     imageInputs[primaryImageIndex] ?? imageInputs[0];
   const base64Image = primaryImage.buffer.toString("base64");
   const allImageDataUrls = imageInputs.map(toDataUrl);

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
           visionModel: vision.model ?? "",
           modelNumbers: vision.model
             ? [vision.model]
             : undefined,
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

   const scraperRejected = shouldRejectScraperProduct(vision, scrapedRaw);
   const priceRejected =
     scraperRejected ||
     (Boolean(scrapedRaw) &&
       !shouldUseScraperPricing(
         vision,
         scrapedRaw!,
         listings.isExactMatch === true,
         detectLuxuryProfile(vision.brand, vision.title)
       ));

   const identificationWarnings = computeIdentificationWarnings({
     vision,
     finalTitle: String(listings.title ?? vision.title),
     finalBrand: String(listings.brand ?? vision.brand ?? ""),
     finalCondition: String(
       listings.condition ?? vision.condition ?? "Used"
     ),
     scraper: scrapedRaw,
     scraperRejected,
     priceRejected,
   });

   logIdentifyPipelineStage("merged", {
     visionTitle: vision.title,
     visionBrand: vision.brand,
     visionConfidence: vision.confidence,
     scraperTitle: scrapedRaw?.title ?? null,
     scraperBrand: scrapedRaw?.brand ?? null,
     scraperPrice: scrapedRaw?.price ?? null,
     finalTitle: listings.title,
     finalBrand: listings.brand,
     finalCondition: listings.condition,
     finalPrice: listings.price,
     scraperRejected,
     priceRejected,
     warningCount: identificationWarnings.messages.length,
   });

   const requiresManualReview =
     fallbackToVision ||
     listings.requiresManualReview === true ||
     identificationWarnings.lowBrandConfidence ||
     identificationWarnings.brandMismatch ||
     identificationWarnings.titleBrandMismatch;
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
         normalizeCondition(listings.condition, listings.brand ?? vision.brand) ||
         normalizeCondition(vision.condition, vision.brand) ||
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
       recommendedPrice: String(
         listings.price ?? listings.medianPrice ?? "0.00"
       ),
       medianPrice: String(listings.medianPrice ?? listings.price ?? "0.00"),
       capturedImage: draftImages[0] ?? allImageDataUrls[0] ?? "",
       capturedImages: allImageDataUrls,
       marketPrices: {
         allegroAvg: String(listings.allegroAvg ?? listings.price ?? "0.00"),
         ebayAvg: String(listings.ebayAvg ?? listings.ebayPrice ?? "0.00"),
         recommendedPrice: String(
           listings.price ?? listings.medianPrice ?? "0.00"
         ),
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
       translation: translationResult
         ? {
             applied: translationResult.applied,
             targetLang: translationResult.targetLang,
             originalTitle: translationResult.originalTitle,
             originalDescription: translationResult.originalDescription,
             translatedTitle: translationResult.translatedTitle ?? null,
             translatedDescription:
               translationResult.translatedDescription ?? null,
             error: translationResult.error ?? null,
             marketplaceIds: job.marketplaceIds ?? [],
           }
         : null,
     }
   };

   console.log("📦 [5/5] Building stateless identify response (no DB persist)...");

   const publishJobId = null;

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
     draftId: null,
     draftPreview: draftData,
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
     brandConfidence: vision.confidence,
     identificationWarnings,
     matchConfidence: listings.matchConfidence ?? "low",
     matchScore: listings.matchScore ?? 0,
     timedOut: listings.timedOut === true,
     confidence: listings.matchConfidence ?? "low",
     scraperSource: listings.scraperSource ?? null,
     scraperMetadata: listings._scraperMetadata ?? null,
     verificationWarning: listings.verificationWarning ?? null,
     translation: translationResult
       ? {
           applied: translationResult.applied,
           targetLang: translationResult.targetLang,
           originalTitle: translationResult.originalTitle,
           originalDescription: translationResult.originalDescription,
           translatedTitle: translationResult.translatedTitle ?? null,
           translatedDescription:
             translationResult.translatedDescription ?? null,
           error: translationResult.error ?? null,
         }
       : null,
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
         normalizeCondition(listings.condition, listings.brand ?? vision.brand) ||
         normalizeCondition(vision.condition, vision.brand) ||
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

// -------------------- TRANSLATION (LibreTranslate) --------------------
app.post("/api/translate", async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text ?? req.body?.q ?? "").trim();
    const targetLang = String(
      req.body?.targetLang ?? req.body?.target ?? ""
    ).trim();
    const sourceLang = String(
      req.body?.sourceLang ?? req.body?.source ?? "auto"
    ).trim();

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    if (!targetLang) {
      return res.status(400).json({ error: "targetLang is required" });
    }

    const result = await translateText({ text, targetLang, sourceLang });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Translate] error:", error);
    const message =
      error instanceof Error ? error.message : "Translation failed";
    const status =
      message.includes("ECONNREFUSED") || message.includes("timeout")
        ? 503
        : 500;
    return res.status(status).json({ error: "Translation failed", message });
  }
});

app.get("/api/translate/health", async (_req: Request, res: Response) => {
  const ok = await checkTranslationServiceHealth();
  res.status(ok ? 200 : 503).json({
    ok,
    url: process.env.LIBRETRANSLATE_URL ?? "http://localhost:5000",
  });
});

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
    const imageInputs = extractIdentifyImages(req);
    if (imageInputs.length === 0) {
      return res.status(400).json({
        error: "No image uploaded",
        message:
          "Send multipart field `images[]` (preferred) or `image`, or JSON { images: [] } / { image }",
      });
    }

    try {
      const identifyOptions = parseIdentifyOptions(req);
      await enqueueIdentifyJob(
        { images: imageInputs, ...identifyOptions },
        (job) => runIdentifyPipeline(job, res)
      );
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

/** Debug identify pipeline — returns raw vision, scraper, and merged output (no DB write). */
app.post(
  "/api/identify/debug",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: MAX_IDENTIFY_IMAGES },
  ]),
  async (req: Request, res: Response) => {
    const imageInputs = extractIdentifyImages(req);
    if (imageInputs.length === 0) {
      return res.status(400).json({
        error: "No image uploaded",
        message:
          "Send multipart field `images[]` (preferred) or `image`, or JSON { images: [] } / { image }",
      });
    }

    try {
      const identifyOptions = parseIdentifyOptions(req);
      const visionPhase = await runVisionPhase(
        { images: imageInputs, ...identifyOptions },
        callVisionForImage
      );
      let { vision, sources, primaryImageIndex, searchQuery, perImage } =
        visionPhase;
      let translationResult: VisionTranslationResult | null = null;

      if (identifyOptions.autoTranslate) {
        const targetLang = resolveTranslationTargetLanguage(identifyOptions);
        if (targetLang && targetLang !== "en") {
          translationResult = await translateVisionListingFields(vision, {
            targetLang,
            sourceLang: "en",
          });
          if (translationResult.applied) {
            vision = translationResult.vision;
            searchQuery = buildScraperSearchQuery(vision);
          }
        }
      }

      const primaryImage =
        imageInputs[primaryImageIndex] ?? imageInputs[0];

      let scrapedRaw: ScrapedListing | null = null;
      try {
        scrapedRaw = (await fetchMasterProductData(searchQuery, {
          vision: {
            visionTitle: vision.title,
            visionBrand: vision.brand ?? "",
            visionModel: vision.model ?? "",
            modelNumbers: vision.model ? [vision.model] : undefined,
          },
          imageBase64: primaryImage.buffer.toString("base64"),
          imageMimeType: primaryImage.mimetype || "image/jpeg",
        })) as ScrapedListing | null;
      } catch {
        scrapedRaw = null;
      }

      let mergedListing: ScrapedListing;
      let fallbackToVision = false;
      if (!scraperHasUsableProduct(scrapedRaw, vision)) {
        fallbackToVision = true;
        mergedListing = buildVisionFallback(vision);
      } else {
        mergedListing = mergeVisionAndScraper(vision, scrapedRaw!);
      }

      const scraperRejected = shouldRejectScraperProduct(vision, scrapedRaw);
      const priceRejected =
        scraperRejected ||
        (Boolean(scrapedRaw) &&
          !shouldUseScraperPricing(
            vision,
            scrapedRaw!,
            mergedListing.isExactMatch === true,
            detectLuxuryProfile(vision.brand, vision.title)
          ));

      const warnings = computeIdentificationWarnings({
        vision,
        finalTitle: String(mergedListing.title ?? vision.title),
        finalBrand: String(mergedListing.brand ?? vision.brand ?? ""),
        finalCondition: String(
          mergedListing.condition ?? vision.condition ?? "Used"
        ),
        scraper: scrapedRaw,
        scraperRejected,
        priceRejected,
      });

      return res.json({
        success: true,
        perImageVision: perImage,
        mergedVision: vision,
        visionSources: sources,
        searchQuery,
        scraperRaw: scrapedRaw,
        mergedListing,
        fallbackToVision,
        scraperRejected,
        priceRejected,
        identificationWarnings: warnings,
        translation: translationResult,
        identifyOptions,
      });
    } catch (error) {
      if (error instanceof VisionIdentifyError) {
        return res.status(422).json({
          message: "Could not identify product from any image",
        });
      }
      console.error("[IdentifyDebug] error:", error);
      return res.status(500).json({
        error: "Debug identification failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// -------------------- HEALTH CHECK ROUTE --------------------
app.get('/api/health', (req: Request, res: Response) => {
 res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------- MARKETPLACE VERIFY (standardized MarketplaceConnectionResult) --------------------

/** Dashboard-friendly hint for common failure modes. */
function verifyHint(
  result: MarketplaceConnectionResult,
  marketplace?: string
): string | undefined {
  if (result.ok) return undefined;
  if (!result.configured) {
    if (marketplace === "etsy" || marketplace === "shopify" || marketplace === "ebay") {
      return "Connect this marketplace in the mobile app (OAuth tokens stay on your device).";
    }
    return "Add the missing environment variables to .env and restart the server.";
  }
  if (result.status === 401) {
    return "Re-connect in the mobile app — tokens are stored on your device only.";
  }
  if (result.status === 403) {
    return "Permission denied — the app likely needs re-authorization or additional API scopes.";
  }
  if (result.status === 400) {
    return "The marketplace rejected the request — the refresh token may be expired or revoked. Re-run the OAuth flow.";
  }
  return undefined;
}

function sendVerifyResult(
  res: Response,
  marketplace: string,
  result: MarketplaceConnectionResult
): Response {
  const httpStatus = result.ok
    ? 200
    : !result.configured
      ? 503
      : result.status >= 400 && result.status < 600
        ? result.status
        : 502;

  return res.status(httpStatus).json({
    marketplace,
    ok: result.ok,
    // `connected` kept as an alias of `ok` for older consumers
    connected: result.ok,
    configured: result.configured,
    status: result.status,
    message: result.message,
    hint: verifyHint(result, marketplace),
    authorizeUrl: resolveVerifyAuthorizeUrl(marketplace, result),
    detail: result.detail,
  });
}

function resolveVerifyAuthorizeUrl(
  _marketplace: string,
  result: MarketplaceConnectionResult
): string | undefined {
  if (result.ok) return undefined;
  return undefined;
}

function makeVerifyRoute(
  marketplace: string,
  verify: () => Promise<MarketplaceConnectionResult>
) {
  return async (_req: Request, res: Response) => {
    try {
      return sendVerifyResult(res, marketplace, await verify());
    } catch (error) {
      console.error(`[${marketplace}] verify connection error:`, error);
      return res.status(500).json({
        marketplace,
        ok: false,
        connected: false,
        configured: true,
        status: 500,
        message:
          error instanceof Error
            ? error.message
            : `${marketplace} verification failed`,
      });
    }
  };
}

app.get("/api/shopify/verify", makeVerifyRoute("shopify", verifyShopifyConnection));
app.get("/api/etsy/verify", makeVerifyRoute("etsy", verifyEtsyConnection));
app.get("/api/ebay/verify", makeVerifyRoute("ebay", verifyEbayConnection));

app.get("/api/marketplaces/oauth-config", (_req, res) => {
  res.json({
    providers: getAllMarketplaceOAuthConfigs(),
    configured: getMarketplaceOAuthConfigs(),
    /** @deprecated use `providers` */
    marketplaces: getMarketplaceOAuthConfigs().map((p) => ({
      marketplace: p.id,
      clientId: p.clientId,
      scopes: p.scopes.join(" "),
      redirectUri: p.redirectUri,
      authorizeUrl: p.authUrl,
      tokenUrl: p.tokenUrl,
      requiresShopDomain: p.requiresShopDomain,
    })),
  });
});

// -------------------- SERVER SETUP --------------------
const server = createServer(app);

(async () => {
 await setupAuth(app);
 registerAuthRoutes(app);
 // Universal marketplace OAuth (Etsy, eBay, Shopify, Amazon)
 registerMarketplaceAuthRoutes(app);
 // Legacy /api/oauth/* routes (backward compatible)
 app.use("/api/oauth", marketplaceOAuthRoutes);
 app.use("/api/onboarding", onboardingRoutes);

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
   console.log(`   - POST /api/translate (LibreTranslate proxy)`);
   console.log(`   - GET  /api/translate/health`);
   console.log(`   - POST /api/identify (1–5 images → OpenAI vision merge → scrape → draft)`);
   console.log(`   - POST /api/catalog/scrape (JSON { query } → masterScraper)`);
   console.log(`   - GET  /api/health`);
   console.log(`   - GET  /api/marketplaces/oauth-config (mobile OAuth metadata)`);
   console.log(`   - GET  /api/auth/:provider/url (universal OAuth)`);
   console.log(`   - GET  /api/auth/callback (unified OAuth callback)`);
   console.log(`   - POST /api/auth/:provider/revoke`);
   console.log(`   - GET  /api/oauth/connections (legacy)`);
   console.log(`   - GET  /api/etsy/verify`);
   console.log(`   - GET  /api/shopify/verify`);
   console.log(`   - GET  /api/ebay/verify`);
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