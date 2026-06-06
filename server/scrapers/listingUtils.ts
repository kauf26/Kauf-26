/** Shared helpers: multi-listing price median + vision-based exact/similar scoring */

import { extractBrandModelFromTitle } from "./brandFromTitle";
import {
  detectLuxuryProfile,
  filterLuxuryListingPrices,
} from "./luxuryPricing";
import {
  computePriceBand,
  isProductPageUrl,
  listingExactRank,
  logListingRankDiagnostics,
  normalizeText,
  scoreListingMatch,
  tokenOverlapRatio,
  topSimilarListings,
  type PriceBand,
} from "./visionMatch";

export {
  listingExactRank,
  scoreListingMatch,
  isCategoryListing,
  isExactListing,
  tokenOverlapRatio,
  extractReferenceNumbers,
  significantTokens,
  logListingRankDiagnostics,
  topSimilarListings,
  EXACT_MATCH_MIN_RANK,
  type ListingRankDiagnostic,
} from "./visionMatch";

export type ScraperSource =
  | "apify"
  | "google"
  | "googleLens"
  | "openai"
  | "rapidapi"
  | "oxylabs"
  | "ebay";

export const SCRAPE_LISTING_LIMIT = 8;
const MIN_PRICED_LISTINGS = 2;

export type RawListing = {
  title?: string;
  brand?: string;
  model?: string;
  description?: string;
  price?: unknown;
  category?: string;
  condition?: string;
  material?: string;
  color?: string;
  url?: string;
  /** Up to 6 gallery URLs from product page (document order) */
  imageUrls?: string[];
};

export type VisionMatchContext = {
  visionTitle: string;
  visionBrand?: string;
  /** Vision model name — used to avoid treating model-first titles as brand */
  visionModel?: string;
  /** Model / reference numbers from search optimizer (e.g. b13050) */
  modelNumbers?: string[];
  /** Dynamic band from peer listing prices in this scrape batch */
  priceBand?: PriceBand | null;
  /** Google Lens or other visual search — boost ranking */
  visualSearchLead?: boolean;
};

const STOP_WORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "your",
  "for",
  "the",
  "and",
  "new",
  "used",
]);

export function parseListingPrice(price: unknown): number {
  const str = String(price ?? "").replace(/[^0-9.]/g, "");
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Drop prices > 2σ from mean (when enough samples) */
export function filterOutlierPrices(prices: number[]): number[] {
  const valid = prices.filter((p) => p > 0);
  if (valid.length < 3) return valid;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance =
    valid.reduce((acc, p) => acc + (p - mean) ** 2, 0) / valid.length;
  const std = Math.sqrt(variance);
  if (std === 0) return valid;
  return valid.filter((p) => Math.abs(p - mean) <= 2 * std);
}

export function medianPrice(prices: number[]): number {
  const filtered = filterOutlierPrices(prices);
  if (filtered.length === 0) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return Math.round(median * 100) / 100;
}

/** @deprecated Use medianPrice */
export function meanPrice(prices: number[]): number {
  return medianPrice(prices);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function titleTokens(title: string, minLen = 3): string[] {
  return normalize(title)
    .split(/\s+/)
    .filter((w) => w.length >= minLen && !STOP_WORDS.has(w));
}

function modelTokenOverlapRatio(
  visionTitle: string,
  visionBrand: string,
  listingTitle: string,
  listingBrand: string
): number {
  const modelTokens = titleTokens(visionTitle).filter((t) => t !== visionBrand);
  if (modelTokens.length === 0) return 1;
  const hits = modelTokens.filter(
    (t) => listingTitle.includes(t) || listingBrand.includes(t)
  ).length;
  return hits / modelTokens.length;
}

function brandTokenSet(brand: string): Set<string> {
  const norm = brand
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!norm) return new Set();
  return new Set(norm.split(/\s+/).filter((w) => w.length >= 2));
}

/** Jaccard similarity on brand tokens (0–1) */
export function brandJaccard(visionBrand: string, listingBrand: string): number {
  const a = brandTokenSet(visionBrand);
  const b = brandTokenSet(listingBrand);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

/** True when listing title contains vision brand (or all brand tokens). */
export function titleMentionsBrand(
  listingTitle: string | undefined,
  visionBrand: string | undefined
): boolean {
  const title = String(listingTitle ?? "").toLowerCase();
  const brand = String(visionBrand ?? "").trim().toLowerCase();
  if (!title || !brand) return false;
  if (title.includes(brand)) return true;
  const tokens = brand.split(/\s+/).filter((t) => t.length > 1);
  return tokens.length > 0 && tokens.every((t) => title.includes(t));
}

const UNRELIABLE_PARSED_BRANDS = new Set([
  "pre",
  "pre-owned",
  "owned",
  "the",
  "hats",
  "hat",
  "caps",
  "cap",
  "shop",
  "store",
  "new",
  "used",
  "vintage",
]);

/** Vision has brand and listing clearly disagrees (e.g. Breitling vs Casio) */
export function brandsConflict(
  visionBrand: string | undefined,
  listingBrand: string | undefined,
  listingTitle?: string
): boolean {
  const vb = String(visionBrand ?? "").trim().toLowerCase();
  if (!vb) return false;

  if (titleMentionsBrand(listingTitle, visionBrand)) return false;

  const lb = String(listingBrand ?? "").trim().toLowerCase();
  if (!lb) return false;
  if (UNRELIABLE_PARSED_BRANDS.has(lb)) return false;
  if (vb === lb || lb.includes(vb) || vb.includes(lb)) return false;
  return brandJaccard(vb, lb) < 0.25;
}

const MODEL_NUMBER_RE = /\b[A-Z]{1,3}[- ]?\d{3,6}[A-Z0-9]*\b|\bref\.?\s*\d+\b/i;

export function hasModelNumber(text: string): boolean {
  return MODEL_NUMBER_RE.test(text);
}

/** Rank parallel scraper outputs — higher = more specific / vision-aligned */
export function scoreScraperCandidate(
  product: Record<string, unknown>,
  vision: VisionMatchContext
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const title = String(product.title ?? "");
  const brand = String(product.brand ?? "");
  const visionBrand = String(vision.visionBrand ?? "").trim();

  if (product.isExactMatch === true) {
    score += 50;
    reasons.push("exact_match");
  } else if (title) {
    score += 15;
    reasons.push("similar_match");
  }

  if (visionBrand) {
    const bj = brandJaccard(visionBrand, brand);
    if (bj >= 0.8) {
      score += 35;
      reasons.push(`brand_jaccard=${bj.toFixed(2)}`);
    } else if (bj >= 0.4) {
      score += 15;
      reasons.push(`brand_partial=${bj.toFixed(2)}`);
    }
  }

  const overlap = tokenOverlapRatio(
    vision.visionTitle,
    visionBrand,
    `${title} ${brand}`
  );
  if (overlap >= 0.5) {
    score += 25;
    reasons.push(`token_overlap=${overlap.toFixed(2)}`);
  }

  if (hasModelNumber(title)) {
    score += 12;
    reasons.push("model_number_in_title");
  }

  const modelNumbers = vision.modelNumbers ?? [];
  const titleNorm = normalizeText(title);
  if (
    modelNumbers.some(
      (m) => m.length >= 4 && titleNorm.includes(m.toLowerCase())
    )
  ) {
    score += 28;
    reasons.push("optimizer_model_in_title");
  }

  const listingUrl = String(product.url ?? product.link ?? "");
  if (isProductPageUrl(listingUrl)) {
    score += 22;
    reasons.push("product_page_url");
  } else if (listingUrl && /\/search(\?|$)/i.test(listingUrl)) {
    score -= 15;
    reasons.push("search_results_url");
  }

  const price = parseListingPrice(product.price);
  if (price > 0) {
    score += 8;
    reasons.push("has_price");
  }
  if (product.priceReliable === true) {
    score += 10;
    reasons.push("price_reliable");
  }

  const desc = String(product.description ?? "");
  if (desc.length >= 40) {
    score += 5;
    reasons.push("rich_description");
  }

  return { score, reasons };
}

function sanitizeBrand(brand: unknown): string {
  const s = String(brand ?? "").trim();
  return !s || s.toUpperCase() === "N/A" ? "" : s;
}

function sanitizeCategory(category: unknown): string {
  const s = String(category ?? "").trim();
  if (!s || /^(general|other)$/i.test(s)) return "";
  return s;
}

export type BrandTitleResolution = {
  brand: string;
  source: string;
  corrected: boolean;
};

export type BrandCoalesceOptions = {
  visionModel?: string;
  listingModel?: string;
};

export function titleParsedBrandIsModelName(
  parsedBrand: string,
  opts?: BrandCoalesceOptions
): boolean {
  const pb = parsedBrand.toLowerCase();
  const vm = String(opts?.visionModel ?? "").trim().toLowerCase();
  const lm = String(opts?.listingModel ?? "").trim().toLowerCase();
  return Boolean((vm && pb === vm) || (lm && pb === lm));
}

/** Pick brand that appears in the listing title — never attach a vision brand the title omits. */
export function coalesceBrandWithTitle(
  title: string,
  listingBrand?: string,
  visionBrand?: string,
  opts?: BrandCoalesceOptions
): BrandTitleResolution {
  const titleStr = String(title ?? "").trim();
  const lb = sanitizeBrand(listingBrand);
  const vb = sanitizeBrand(visionBrand);
  const fromTitle = sanitizeBrand(
    extractBrandModelFromTitle(titleStr).brand
  );

  if (lb && titleMentionsBrand(titleStr, lb)) {
    return { brand: lb, source: "listing.brand", corrected: false };
  }
  if (fromTitle && titleMentionsBrand(titleStr, fromTitle)) {
    const trustedBrand = lb || vb;
    if (
      trustedBrand &&
      titleParsedBrandIsModelName(fromTitle, opts) &&
      fromTitle.toLowerCase() !== trustedBrand.toLowerCase()
    ) {
      return {
        brand: trustedBrand,
        source: "vision.model_not_brand",
        corrected: true,
      };
    }
    const corrected = Boolean(lb && lb.toLowerCase() !== fromTitle.toLowerCase());
    return {
      brand: fromTitle,
      source: corrected ? "title.parse" : "listing.brand_or_title",
      corrected,
    };
  }
  if (vb && titleMentionsBrand(titleStr, vb)) {
    return { brand: vb, source: "vision.brand", corrected: Boolean(lb && lb !== vb) };
  }
  if (lb && brandsConflict(vb, lb, titleStr)) {
    return { brand: fromTitle || lb, source: "title.parse_conflict", corrected: true };
  }
  if (lb) return { brand: lb, source: "listing.brand", corrected: false };
  if (fromTitle) return { brand: fromTitle, source: "title.parse", corrected: false };
  return { brand: "", source: "none", corrected: false };
}

export function validateBrandTitleConsistency(
  title: string,
  brand: string,
  label = "listingUtils"
): { ok: boolean; message: string } {
  const t = String(title ?? "").trim();
  const b = sanitizeBrand(brand);
  if (!t || !b) return { ok: true, message: "skipped_empty" };
  if (titleMentionsBrand(t, b)) {
    return { ok: true, message: "title_contains_brand" };
  }
  const msg = `[${label}] brand-title mismatch: title="${t}" brand="${b}"`;
  console.error(msg);
  return { ok: false, message: msg };
}

function representativeListingScore(
  item: RawListing,
  matchCtx: VisionMatchContext,
  exactRank: number
): number {
  const title = String(item.title ?? "");
  const brand = sanitizeBrand(item.brand);
  const parsedBrand = sanitizeBrand(extractBrandModelFromTitle(title).brand);
  let score = exactRank;

  if (parsedBrand && titleMentionsBrand(title, parsedBrand)) {
    score += 55;
    if (!brand || brand.toLowerCase() === parsedBrand.toLowerCase()) score += 15;
  } else if (brand && titleMentionsBrand(title, brand)) {
    score += 45;
  } else if (brand) {
    score -= 60;
  }

  const vb = sanitizeBrand(matchCtx.visionBrand);
  if (vb && titleMentionsBrand(title, vb)) score += 15;
  else if (
    vb &&
    parsedBrand &&
    brandsConflict(vb, parsedBrand, title) &&
    titleMentionsBrand(title, parsedBrand)
  ) {
    score += 30;
  } else if (vb && brandsConflict(vb, brand || parsedBrand, title)) {
    score -= 25;
  }

  return score;
}

function pickRepresentativeListing(
  scored: Array<{ item: RawListing; score: "exact" | "similar"; price: number }>,
  matchCtx: VisionMatchContext,
  hasExact: boolean
): RawListing {
  const pool = hasExact
    ? scored.filter((s) => s.score === "exact")
    : scored;

  const ranked = pool
    .map((s) => ({
      item: s.item,
      repScore: representativeListingScore(
        s.item,
        matchCtx,
        listingExactRank(s.item, matchCtx)
      ),
    }))
    .sort((a, b) => b.repScore - a.repScore);

  return ranked[0]?.item ?? pool[0]?.item ?? scored[0].item;
}

/** Collapse N marketplace rows → one product row with median price + match flags */
export function aggregateListings(
  items: RawListing[],
  query: string,
  ctx?: VisionMatchContext
): Record<string, unknown> | null {
  if (!items.length) return null;

  const baseCtx: VisionMatchContext = ctx ?? {
    visionTitle: query,
    visionBrand: "",
  };

  const luxuryProfile = detectLuxuryProfile(
    baseCtx.visionBrand,
    baseCtx.visionTitle,
    query
  );

  const peerPrices = filterLuxuryListingPrices(
    items.map((item) => parseListingPrice(item.price)),
    luxuryProfile
  );
  const priceBand =
    baseCtx.priceBand ?? computePriceBand(peerPrices) ?? null;

  const matchCtx: VisionMatchContext = {
    ...baseCtx,
    priceBand,
  };

  const scored = items.map((item) => ({
    item,
    score: scoreListingMatch(item, matchCtx),
    price: parseListingPrice(item.price),
  }));

  logListingRankDiagnostics(items, matchCtx, {
    label: "listingUtils",
    limit: 5,
  });

  const exactRows = scored.filter((s) => s.score === "exact");
  const hasExact = exactRows.length > 0;
  const pool = hasExact ? exactRows : scored;
  const pricedInPool = pool.filter((s) => s.price > 0);
  const pricedCount = pricedInPool.length;
  const priceReliable = pricedCount >= MIN_PRICED_LISTINGS;
  const pricedForMedian =
    pricedInPool.length > 0
      ? pricedInPool.map((s) => s.price)
      : peerPrices;
  const median =
    pricedForMedian.length > 0 ? medianPrice(pricedForMedian) : 0;

  const rep = pickRepresentativeListing(scored, matchCtx, hasExact);
  const repTitle = String(rep.title ?? query);
  const brandResolution = coalesceBrandWithTitle(
    repTitle,
    rep.brand,
    matchCtx.visionBrand,
    {
      visionModel: matchCtx.visionModel,
      listingModel: rep.model,
    }
  );
  validateBrandTitleConsistency(repTitle, brandResolution.brand, "aggregateListings");

  const bestLink = rep.url ?? "";

  const similarMatches = hasExact
    ? []
    : topSimilarListings(items, matchCtx, 3);

  const fieldSources = {
    title: "rep.title",
    brand: brandResolution.source,
    description: "rep.description",
    category: "rep.category",
    condition: "rep.condition",
    material: "rep.material",
    color: "rep.color",
    url: "rep.url",
    price: "median(pool)",
  };

  console.log("[listingUtils] aggregateListings:", {
    totalItems: items.length,
    exactMatches: exactRows.length,
    isExactMatch: hasExact,
    pricedListingsUsed: pricedCount,
    medianPrice: median,
    priceReliable,
    repTitle,
    repBrand: brandResolution.brand,
    brandCorrected: brandResolution.corrected,
    fieldSources,
    topSimilar: similarMatches.map((s) => ({
      title: s.title,
      exactRank: s.exactRank,
    })),
  });

  return {
    title: repTitle,
    brand: brandResolution.brand,
    model: String(rep.model ?? "").trim(),
    description: rep.description ?? "",
    category: sanitizeCategory(rep.category),
    condition: String(rep.condition ?? "").trim(),
    material: String(rep.material ?? "").trim(),
    color: String(rep.color ?? "").trim(),
    price: median,
    medianPrice: median,
    ebayAvg: median,
    allegroAvg: median,
    priceMin: priceBand?.min ?? (pricedForMedian.length ? Math.min(...pricedForMedian) : 0),
    priceMax: priceBand?.max ?? (pricedForMedian.length ? Math.max(...pricedForMedian) : 0),
    isExactMatch: hasExact,
    matchType: hasExact ? "exact" : "similar",
    priceReliable,
    listingCount: items.length,
    exactMatchCount: exactRows.length,
    samplesPriced: pricedCount,
    link: bestLink,
    url: bestLink,
    similarMatches,
    fieldSources,
    brandTitleCorrected: brandResolution.corrected,
  };
}
