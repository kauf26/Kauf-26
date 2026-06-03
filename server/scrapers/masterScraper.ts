import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeGoogle } from "./googleShopping";
import { scrapeProduct as scrapeRapidAPI } from "./rapidapi";
import {
  brandJaccard,
  brandsConflict,
  scoreScraperCandidate,
  type ScraperSource,
  type VisionMatchContext,
} from "./listingUtils";
import dotenv from "dotenv";
dotenv.config();

export type MatchType = "exact" | "similar" | "generic";
export type MatchConfidence = "low" | "medium" | "high";

export type ScrapeOptions = {
  vision?: VisionMatchContext;
};

const MIN_PARALLEL_WAIT_MS = 12_000;
const SCRAPER_ATTEMPT_TIMEOUT_MS = 10_000;
const SCRAPER_MAX_ATTEMPTS = 2;
const HIGH_CONFIDENCE_SCORE = 80;
const MEDIUM_CONFIDENCE_SCORE = 50;
const HIGH_CONFIDENCE_THRESHOLD = 60;

const LUXURY_WATCH_BRANDS = [
  "breitling",
  "rolex",
  "omega",
  "tag heuer",
  "patek",
  "cartier",
  "iwc",
  "panerai",
  "hublot",
  "audemars",
];

const GENERIC_TITLE_PATTERNS = [
  /^analog\s+pilot\s+watch$/i,
  /^men'?s?\s+watch$/i,
  /^wrist\s+watch$/i,
  /^analog\s+watch$/i,
];

const truncateDescription = (text: string, query: string): string => {
  if (!text || text.trim() === "") return "";
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function confidenceFromScore(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE_SCORE) return "high";
  if (score >= MEDIUM_CONFIDENCE_SCORE) return "medium";
  return "low";
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`[${label}] timed out after ${ms}ms`)),
        ms
      );
    }),
  ]);
}

function isLuxuryWatchContext(vision: VisionMatchContext): boolean {
  const brand = String(vision.visionBrand ?? "").toLowerCase();
  const title = vision.visionTitle.toLowerCase();
  if (LUXURY_WATCH_BRANDS.some((b) => brand.includes(b) || title.includes(b)))
    return true;
  return /\bwatch(es)?\b/.test(title) && brand.length > 0;
}

function isGenericTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t || t === "watch") return true;
  return GENERIC_TITLE_PATTERNS.some((re) => re.test(t));
}

function brandAppearsInTitle(visionBrand: string, title: string): boolean {
  const b = visionBrand.trim().toLowerCase();
  if (!b) return false;
  return title.toLowerCase().includes(b);
}

/** Accuracy-first scoring: brand+model in title, realistic luxury price, vision alignment */
export function scoreResult(
  vision: VisionMatchContext,
  scraperData: Record<string, unknown>
): { score: number; reasons: string[] } {
  const base = scoreScraperCandidate(scraperData, vision);
  let score = base.score;
  const reasons = [...base.reasons];

  const title = String(scraperData.title ?? "");
  const brand = String(scraperData.brand ?? "");
  const price = parsePrice(scraperData.price);
  const visionBrand = String(vision.visionBrand ?? "").trim();
  const luxury = isLuxuryWatchContext(vision);

  if (visionBrand && brandAppearsInTitle(visionBrand, title)) {
    score += 40;
    reasons.push("vision_brand_in_title");
  } else if (visionBrand && brand.toLowerCase() === visionBrand.toLowerCase()) {
    score += 30;
    reasons.push("vision_brand_match");
  }

  if (isGenericTitle(title)) {
    score -= 50;
    reasons.push("penalty_generic_title");
  }

  if (luxury) {
    if (price >= 100) {
      score += 25;
      reasons.push("luxury_price_realistic");
    } else if (price > 0 && price < 100) {
      score -= 60;
      reasons.push("penalty_luxury_low_price");
    }
  }

  if (scraperData.isExactMatch === true) score += 15;

  return { score, reasons };
}

function isPlaceholderDescription(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("general item matching") ||
    t.includes("details pending manual review") ||
    t.includes("please review the details manually") ||
    t.includes("similar listing match for") ||
    t.length < 12
  );
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

function normalizeCondition(condition: unknown): string {
  const s = String(condition ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "like new" || lower === "like-new" || lower === "mint") {
    return "Like New";
  }
  if (lower === "new" || lower === "brand new") return "New";
  if (lower === "used" || lower === "pre-owned") return "Used";
  if (lower === "fair" || lower === "vintage") return "Fair";
  return s;
}

function buildListingDescription(
  scraped: Record<string, unknown>,
  title: string
): string {
  const raw = String(scraped.description ?? "").trim();
  if (raw && !isPlaceholderDescription(raw)) {
    return truncateDescription(raw, title);
  }
  const parts = [
    scraped.color ? `Color: ${scraped.color}` : null,
    scraped.material ? `Material: ${scraped.material}` : null,
  ]
    .filter(Boolean)
    .map(String);
  if (parts.length > 0) return truncateDescription(parts.join(" "), title);
  return "";
}

function parsePrice(price: unknown): number {
  const str = String(price).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0.0 : parsed;
}

function resolveOpenAIFallbackPrice(aiData: {
  price?: unknown;
  description?: string;
}): number {
  const fromField = parsePrice(aiData.price);
  if (fromField > 0) return fromField;
  if (aiData.description) {
    const fromDesc = inferPriceFromDescription(aiData.description);
    if (fromDesc > 0) return fromDesc;
  }
  return 0;
}

function validateProduct(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.title || d.title === "N/A") return false;
  if (
    parsePrice(d.price) === 0 &&
    (!d.description || String(d.description).length < 10)
  ) {
    return false;
  }
  return true;
}

function attachScrapeMeta(
  result: Record<string, unknown>,
  meta: {
    timedOut: boolean;
    matchConfidence: MatchConfidence;
    matchScore: number;
  }
): Record<string, unknown> {
  return { ...result, ...meta };
}

/** Exact marketplace listing — preserve fields as returned (no description trim). */
function buildExactProduct(
  data: Record<string, unknown>,
  query: string
): Record<string, unknown> {
  const price = parsePrice(data.price);
  return {
    ...data,
    title: String(data.title ?? query).trim(),
    brand: sanitizeBrand(data.brand),
    category: sanitizeCategory(data.category),
    condition: normalizeCondition(data.condition),
    material: String(data.material ?? "").trim(),
    color: String(data.color ?? "").trim(),
    style: String(data.style ?? "").trim(),
    price,
    allegroAvg: parsePrice(data.allegroAvg ?? data.price),
    ebayAvg: parsePrice(data.ebayAvg ?? data.ebayPrice ?? data.price),
    description: buildListingDescription(data, String(data.title ?? query)),
    isExactMatch: true,
    matchType: "exact" satisfies MatchType,
    scraperSource: data.scraperSource,
  };
}

export function mergeSimilarProduct(
  scraped: Record<string, unknown>,
  context?: { visionTitle?: string; visionCategory?: string }
): Record<string, unknown> {
  const title = String(scraped.title ?? context?.visionTitle ?? "").trim();
  const price = parsePrice(scraped.price);
  const allegroAvg = parsePrice(scraped.allegroAvg ?? scraped.price);
  const ebayAvg = parsePrice(
    scraped.ebayAvg ?? scraped.ebayPrice ?? scraped.price
  );
  const description = buildListingDescription(scraped, title);

  return {
    ...scraped,
    title,
    brand: sanitizeBrand(scraped.brand),
    category:
      sanitizeCategory(scraped.category) ||
      sanitizeCategory(context?.visionCategory),
    condition: normalizeCondition(scraped.condition),
    material: String(scraped.material ?? "").trim(),
    color: String(scraped.color ?? "").trim(),
    style: String(scraped.style ?? "").trim(),
    price: price || allegroAvg || ebayAvg,
    allegroAvg,
    ebayAvg,
    description,
    isExactMatch: false,
    matchType: "similar" satisfies MatchType,
    scraperSource: scraped.scraperSource,
  };
}

function buildGenericProduct(
  data: Record<string, unknown>,
  query: string
): Record<string, unknown> {
  const price = parsePrice(data.price);
  return {
    ...data,
    title: String(data.title ?? query).trim(),
    brand: sanitizeBrand(data.brand),
    category: sanitizeCategory(data.category),
    condition: normalizeCondition(data.condition),
    material: String(data.material ?? "").trim(),
    color: String(data.color ?? "").trim(),
    style: String(data.style ?? "").trim(),
    price,
    allegroAvg: price,
    ebayAvg: price,
    description: buildListingDescription(data, String(data.title ?? query)),
    isExactMatch: false,
    matchType: "generic" satisfies MatchType,
    scraperSource: "openai" satisfies ScraperSource,
  };
}

type ScraperRunner = {
  source: ScraperSource;
  run: (
    query: string,
    vision?: VisionMatchContext
  ) => Promise<Record<string, unknown> | null>;
};

async function runOpenAIScraper(
  query: string,
  _vision?: VisionMatchContext
): Promise<Record<string, unknown> | null> {
  const aiData = await scrapeOpenAI(query);
  if (!aiData || !validateProduct(aiData)) return null;
  const price = resolveOpenAIFallbackPrice(aiData);
  return buildGenericProduct(
    {
      title: aiData.title,
      brand: sanitizeBrand(aiData.brand),
      price,
      description: aiData.description,
      category: sanitizeCategory(aiData.category),
      condition: normalizeCondition(aiData.condition),
      material: String((aiData as { material?: string }).material ?? "").trim(),
      color: String((aiData as { color?: string }).color ?? "").trim(),
    },
    query
  );
}

async function runScraperWithRetry(
  source: ScraperSource,
  run: ScraperRunner["run"],
  query: string,
  vision: VisionMatchContext
): Promise<{
  source: ScraperSource;
  value: Record<string, unknown> | null;
  timedOut: boolean;
}> {
  let timedOut = false;
  for (let attempt = 1; attempt <= SCRAPER_MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    try {
      const value = await withTimeout(
        run(query, vision),
        SCRAPER_ATTEMPT_TIMEOUT_MS,
        `${source}#${attempt}`
      );
      console.log(
        `[MasterScraper] ${source} attempt ${attempt} finished in ${Date.now() - t0}ms`
      );
      return { source, value, timedOut };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("timed out")) timedOut = true;
      console.warn(
        `[MasterScraper] ${source} attempt ${attempt} failed (${Date.now() - t0}ms):`,
        msg
      );
    }
  }
  return { source, value: null, timedOut };
}

export const scrapeProduct = async (
  query: string,
  options?: ScrapeOptions
): Promise<Record<string, unknown> | null> => {
  console.log(`[MasterScraper] Initiating search for: ${query}`);
  const vision: VisionMatchContext = options?.vision ?? {
    visionTitle: query,
    visionBrand: "",
  };

  const runners: ScraperRunner[] = [
    { source: "apify", run: scrapeApify },
    { source: "rapidapi", run: scrapeRapidAPI },
    { source: "google", run: scrapeGoogle },
    { source: "openai", run: runOpenAIScraper },
  ];

  console.log(
    `[MasterScraper] Running ${runners.length} scrapers (wait for all, min ${MIN_PARALLEL_WAIT_MS}ms):`,
    runners.map((r) => r.source).join(", ")
  );

  let anyScraperTimedOut = false;
  const parallelStart = Date.now();
  const [settledResults] = await Promise.all([
    Promise.allSettled(
      runners.map(({ source, run }) =>
        runScraperWithRetry(source, run, query, vision)
      )
    ),
    sleep(MIN_PARALLEL_WAIT_MS),
  ]);
  console.log(
    `[MasterScraper] All scrapers settled in ${Date.now() - parallelStart}ms`
  );

  type Candidate = {
    source: ScraperSource;
    product: Record<string, unknown>;
    score: number;
    reasons: string[];
  };

  const candidates: Candidate[] = [];

  for (const res of settledResults) {
    if (res.status !== "fulfilled") {
      console.warn("[MasterScraper] Scraper rejected:", res.reason);
      continue;
    }
    const { source, value, timedOut } = res.value;
    if (timedOut) anyScraperTimedOut = true;
    if (!value || !validateProduct(value)) {
      console.log(`[MasterScraper] ${source}: no valid product`);
      continue;
    }

    const listingBrand = String(value.brand ?? "");
    if (brandsConflict(vision.visionBrand, listingBrand)) {
      console.warn(
        `[MasterScraper] ${source}: REJECTED brand conflict — vision="${vision.visionBrand}" vs listing="${listingBrand}" (jaccard=${brandJaccard(vision.visionBrand ?? "", listingBrand).toFixed(2)})`
      );
      continue;
    }

    const scored = scoreResult(vision, value);
    console.log(
      `[MasterScraper] ${source}: score=${scored.score} [${scored.reasons.join(", ")}]`
    );
    candidates.push({
      source,
      product: { ...value, scraperSource: source },
      score: scored.score,
      reasons: scored.reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    console.log(
      "[MasterScraper] No scraper returned vision-consistent data — caller should use vision fallback",
      anyScraperTimedOut ? "(some scrapers timed out)" : ""
    );
    return null;
  }

  const winner = candidates[0];
  const matchScore = winner.score;
  const matchConfidence = confidenceFromScore(matchScore);

  console.log(
    `[MasterScraper] WINNER: ${winner.source} (score=${winner.score}) — ${winner.reasons.join(", ")}`
  );
  console.log(
    `[MasterScraper] Winner preview — title: "${String(winner.product.title ?? "")}" brand: "${String(winner.product.brand ?? "")}" price: ${winner.product.price ?? 0}`
  );
  if (candidates.length > 1) {
    console.log(
      "[MasterScraper] Runner-up:",
      candidates
        .slice(1, 3)
        .map((c) => `${c.source}=${c.score}`)
        .join("; ")
    );
  }

  const meta = {
    timedOut: anyScraperTimedOut,
    matchConfidence,
    matchScore,
  };

  let raw = winner.product;
  if (matchScore < HIGH_CONFIDENCE_THRESHOLD) {
    console.warn(
      `[MasterScraper] Score ${matchScore} below threshold ${HIGH_CONFIDENCE_THRESHOLD} — isExactMatch=false`
    );
    raw = { ...raw, isExactMatch: false, matchType: "similar" };
  }

  if (raw.isExactMatch === true) {
    const result = buildExactProduct(raw, query);
    console.log("[MasterScraper] Price stats:", {
      price: result.price,
      priceReliable: result.priceReliable,
      isExactMatch: result.isExactMatch,
      scraperSource: result.scraperSource,
      brand: result.brand,
      title: result.title,
      matchConfidence,
      timedOut: anyScraperTimedOut,
    });
    return attachScrapeMeta(result, meta);
  }

  const result = mergeSimilarProduct(raw, {
    visionTitle: vision.visionTitle,
    visionCategory: undefined,
  });
  console.log("[MasterScraper] Price stats:", {
    price: result.price,
    priceReliable: result.priceReliable,
    isExactMatch: result.isExactMatch,
    scraperSource: result.scraperSource,
    brand: result.brand,
    title: result.title,
    matchConfidence,
    timedOut: anyScraperTimedOut,
  });
  return attachScrapeMeta(result, meta);
};
