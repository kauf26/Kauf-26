/** Shared helpers: multi-listing price median + vision-based exact/similar scoring */

export type ScraperSource =
  | "apify"
  | "google"
  | "openai"
  | "rapidapi"
  | "oxylabs";

export const SCRAPE_LISTING_LIMIT = 8;
const MIN_PRICED_LISTINGS = 3;

export type RawListing = {
  title?: string;
  brand?: string;
  description?: string;
  price?: unknown;
  category?: string;
  condition?: string;
  material?: string;
  color?: string;
};

export type VisionMatchContext = {
  visionTitle: string;
  visionBrand?: string;
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

/** Vision has brand and listing brand clearly disagrees (e.g. Breitling vs Casio) */
export function brandsConflict(
  visionBrand: string | undefined,
  listingBrand: string | undefined
): boolean {
  const vb = String(visionBrand ?? "").trim().toLowerCase();
  const lb = String(listingBrand ?? "").trim().toLowerCase();
  if (!vb || !lb) return false;
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

  const overlap = modelTokenOverlapRatio(
    vision.visionTitle,
    visionBrand.toLowerCase(),
    normalize(title),
    normalize(brand)
  );
  if (overlap >= 0.5) {
    score += 25;
    reasons.push(`model_overlap=${overlap.toFixed(2)}`);
  }

  if (hasModelNumber(title)) {
    score += 12;
    reasons.push("model_number_in_title");
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

/**
 * exact = strict brand + model match when vision has a brand; else title overlap
 * similar = returned by marketplace search but not exact
 */
export function scoreListingMatch(
  listing: RawListing,
  ctx: VisionMatchContext
): "exact" | "similar" {
  const listingTitle = normalize(listing.title ?? "");
  const listingBrand = normalize(listing.brand ?? "");
  const visionBrand = normalize(ctx.visionBrand ?? "");

  if (!listingTitle) return "similar";

  if (visionBrand) {
    if (!listingBrand) return "similar";
    if (listingBrand !== visionBrand) return "similar";

    const overlap = modelTokenOverlapRatio(
      ctx.visionTitle,
      visionBrand,
      listingTitle,
      listingBrand
    );
    return overlap >= 0.5 ? "exact" : "similar";
  }

  const vt = titleTokens(ctx.visionTitle, 4);
  const lt = new Set(titleTokens(listing.title ?? "", 4));
  if (vt.length === 0) return "similar";
  const overlap = vt.filter((t) => lt.has(t)).length;
  if (overlap / vt.length >= 0.6) return "exact";
  return "similar";
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

/** Collapse N marketplace rows → one product row with median price + match flags */
export function aggregateListings(
  items: RawListing[],
  query: string,
  ctx?: VisionMatchContext
): Record<string, unknown> | null {
  if (!items.length) return null;

  const matchCtx: VisionMatchContext = ctx ?? {
    visionTitle: query,
    visionBrand: "",
  };

  const scored = items.map((item) => ({
    item,
    score: scoreListingMatch(item, matchCtx),
    price: parseListingPrice(item.price),
  }));

  const exactRows = scored.filter((s) => s.score === "exact");
  const hasExact = exactRows.length > 0;
  const pool = hasExact ? exactRows : scored;
  const pricedInPool = pool.filter((s) => s.price > 0);
  const pricedCount = pricedInPool.length;
  const priceReliable = pricedCount >= MIN_PRICED_LISTINGS;
  const median = priceReliable
    ? medianPrice(pricedInPool.map((s) => s.price))
    : 0;
  const rep = (hasExact ? exactRows[0] : scored[0]).item;

  console.log("[listingUtils] aggregateListings:", {
    totalItems: items.length,
    exactMatches: exactRows.length,
    isExactMatch: hasExact,
    pricedListingsUsed: pricedCount,
    medianPrice: median,
    priceReliable,
  });

  return {
    title: rep.title ?? query,
    brand: sanitizeBrand(rep.brand) || sanitizeBrand(matchCtx.visionBrand),
    description: rep.description ?? "",
    category: sanitizeCategory(rep.category),
    condition: String(rep.condition ?? "").trim(),
    material: String(rep.material ?? "").trim(),
    color: String(rep.color ?? "").trim(),
    price: priceReliable ? median : 0,
    ebayAvg: priceReliable ? median : 0,
    allegroAvg: priceReliable ? median : 0,
    isExactMatch: hasExact,
    priceReliable,
    listingCount: items.length,
    samplesPriced: pricedCount,
  };
}
