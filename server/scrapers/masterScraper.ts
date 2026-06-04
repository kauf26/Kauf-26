import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeGoogle } from "./googleShopping";
import { scrapeProduct as scrapeRapidAPI } from "./rapidapi";
import { scrapeProduct as scrapeEbay } from "./ebayBrowse";
import { scrapeProduct as scrapeGoogleLens } from "./googleLens";
import {
  buildBroadMarketplaceQuery,
  buildExactMarketplaceQuery,
} from "./marketplaceQuery";
import { buildQueryExpansionChain } from "./queryExpansion";
import {
  GLOBAL_EXACT_RACE_TIMEOUT_MS,
  raceScrapersForExactMatch,
  type ScraperRunner,
} from "./scraperRace";
import {
  isAbortError,
  type ScraperRunOptions,
} from "./scraperOptions";
import type { ListingRankDiagnostic } from "./visionMatch";
import {
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
  /** User-editable term from draft re-search (prepended to expansion chain) */
  searchQuery?: string;
  /** Camera capture for Google Lens (raw base64, no data: prefix) */
  imageBase64?: string;
  imageMimeType?: string;
};

const SCRAPER_MAX_ATTEMPTS = 1;

const SCRAPER_TIMEOUT_MS: Record<ScraperSource, number> = {
  apify: 32_000,
  googleLens: Number(process.env.GOOGLE_LENS_TIMEOUT_MS ?? 45_000),
  ebay: 12_000,
  google: 8_000,
  rapidapi: 8_000,
  openai: 12_000,
  oxylabs: 5_000,
};

const GOOGLE_LENS_PHASE_TIMEOUT_MS = Number(
  process.env.GOOGLE_LENS_TIMEOUT_MS ?? 45_000
);
const HIGH_CONFIDENCE_SCORE = 80;
const MEDIUM_CONFIDENCE_SCORE = 50;
const HIGH_CONFIDENCE_THRESHOLD = 60;

const truncateDescription = (text: string, query: string): string => {
  if (!text || text.trim() === "") return "";
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

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

/** Rank scraper candidates: exact matches first, then vision token overlap */
export function scoreResult(
  vision: VisionMatchContext,
  scraperData: Record<string, unknown>
): { score: number; reasons: string[] } {
  const base = scoreScraperCandidate(scraperData, vision);
  let score = base.score;
  const reasons = [...base.reasons];

  if (scraperData.isExactMatch === true) {
    score += 60;
    reasons.push("exact_match_priority");
  }

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

function logNoExactMatchWarning(
  vision: VisionMatchContext,
  queries: { exact: string; broad: string; expansionChain: string[] },
  winner: Record<string, unknown> | null,
  candidates: Array<{ product: Record<string, unknown>; source: ScraperSource }>
): void {
  if (winner?.isExactMatch === true) return;

  const fromWinner = winner?.similarMatches;
  let topSimilar: ListingRankDiagnostic[] = [];
  if (Array.isArray(fromWinner) && fromWinner.length > 0) {
    topSimilar = fromWinner as ListingRankDiagnostic[];
  } else {
    topSimilar = candidates.slice(0, 3).map((c, i) => ({
      index: i + 1,
      title: String(c.product.title ?? ""),
      brand: String(c.product.brand ?? ""),
      price: String(c.product.price ?? "n/a"),
      exactRank: Number(c.product.matchScore ?? 0),
      meetsExactThreshold: false,
      matchType: "similar" as const,
    }));
  }

  console.warn(
    "[MasterScraper] NO EXACT MATCH — verify product appears in search results:",
    JSON.stringify(
      {
        visionTitle: vision.visionTitle,
        visionBrand: vision.visionBrand ?? "",
        exactQuery: queries.exact,
        broadQuery: queries.broad,
        expansionChain: queries.expansionChain,
        winnerTitle: winner?.title ?? null,
        topSimilarMatches: topSimilar.map((s) => ({
          title: s.title,
          brand: s.brand,
          price: s.price,
          exactRank: s.exactRank,
        })),
      },
      null,
      2
    )
  );
}

async function runOpenAIScraper(
  query: string,
  _vision?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> {
  const aiData = await scrapeOpenAI(query, opts?.signal);
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
  vision: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<{
  source: ScraperSource;
  value: Record<string, unknown> | null;
  timedOut: boolean;
  aborted: boolean;
  elapsedMs: number;
}> {
  let timedOut = false;
  const t0 = Date.now();
  for (let attempt = 1; attempt <= SCRAPER_MAX_ATTEMPTS; attempt++) {
    if (opts?.signal?.aborted) {
      return {
        source,
        value: null,
        timedOut: false,
        aborted: true,
        elapsedMs: Date.now() - t0,
      };
    }
    const attemptStart = Date.now();
    try {
      const timeoutMs = SCRAPER_TIMEOUT_MS[source] ?? 12_000;
      const value = await withTimeout(
        run(query, vision, opts),
        timeoutMs,
        `${source}#${attempt}`
      );
      console.log(
        `[MasterScraper] ${source} attempt ${attempt} finished in ${Date.now() - attemptStart}ms`
      );
      return {
        source,
        value,
        timedOut,
        aborted: false,
        elapsedMs: Date.now() - t0,
      };
    } catch (err) {
      if (isAbortError(err)) {
        return {
          source,
          value: null,
          timedOut: false,
          aborted: true,
          elapsedMs: Date.now() - t0,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("timed out")) timedOut = true;
      console.warn(
        `[MasterScraper] ${source} attempt ${attempt} failed (${Date.now() - attemptStart}ms):`,
        msg
      );
    }
  }
  return {
    source,
    value: null,
    timedOut,
    aborted: false,
    elapsedMs: Date.now() - t0,
  };
}

export const scrapeProduct = async (
  query: string,
  options?: ScrapeOptions
): Promise<Record<string, unknown> | null> => {
  const vision: VisionMatchContext = options?.vision ?? {
    visionTitle: query,
    visionBrand: "",
  };
  const manualQuery = options?.searchQuery?.trim();
  const exactQuery =
    manualQuery || buildExactMarketplaceQuery(query, vision.visionBrand);
  const broadQuery = buildBroadMarketplaceQuery(query, vision.visionBrand);
  const expansionChain = manualQuery
    ? [
        manualQuery,
        ...buildQueryExpansionChain(query, vision.visionBrand).filter(
          (q) => q.toLowerCase() !== manualQuery.toLowerCase()
        ),
      ]
    : buildQueryExpansionChain(query, vision.visionBrand);

  const queryPlan = { exact: exactQuery, broad: broadQuery, expansionChain };
  console.log("[MasterScraper] Search plan:", JSON.stringify(queryPlan, null, 2));

  const lensBase64 = options?.imageBase64?.trim();
  if (lensBase64 && process.env.APIFY_API_KEY?.trim()) {
    const lensStart = Date.now();
    console.log(
      "[MasterScraper] Phase 0: Google Lens (products mode) — priority before keyword scrapers"
    );
    try {
      const lensRaw = await withTimeout(
        scrapeGoogleLens(exactQuery, vision, {
          imageBase64: lensBase64,
          imageMimeType: options?.imageMimeType ?? "image/jpeg",
        }),
        GOOGLE_LENS_PHASE_TIMEOUT_MS,
        "googleLens-phase"
      );

      if (lensRaw && validateProduct(lensRaw)) {
        const listingBrand = String(lensRaw.brand ?? "");
        if (!brandsConflict(vision.visionBrand, listingBrand)) {
          if (lensRaw.isExactMatch === true) {
            const lensMs = Date.now() - lensStart;
            console.log(
              `[MasterScraper] WINNER (exact match) from googleLens in ${lensMs}ms — skipping keyword scrapers`
            );
            const scored = scoreResult(vision, lensRaw);
            const meta = {
              timedOut: false,
              matchConfidence: confidenceFromScore(scored.score),
              matchScore: scored.score,
            };
            const result = buildExactProduct(
              { ...lensRaw, scraperSource: "googleLens" },
              query
            );
            return attachScrapeMeta(result, meta);
          }
          console.log(
            `[MasterScraper] Google Lens finished in ${Date.now() - lensStart}ms — similar only, running keyword scrapers`
          );
        } else {
          console.warn(
            "[MasterScraper] Google Lens brand conflict with vision — running keyword scrapers"
          );
        }
      } else {
        console.log(
          `[MasterScraper] Google Lens no valid product (${Date.now() - lensStart}ms) — running keyword scrapers`
        );
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.warn(
          "[MasterScraper] Google Lens phase failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log(
    `[MasterScraper] Per-scraper primary query: apify=expansion(${expansionChain.length}), ebay/google/rapidapi="${exactQuery}"`
  );

  const runners: ScraperRunner[] = [
    { source: "apify", run: scrapeApify },
    { source: "ebay", run: scrapeEbay },
    { source: "google", run: scrapeGoogle },
    { source: "rapidapi", run: scrapeRapidAPI },
    { source: "openai", run: runOpenAIScraper },
  ];

  console.log(
    `[MasterScraper] Racing ${runners.length} scrapers for exact match (global timeout ${GLOBAL_EXACT_RACE_TIMEOUT_MS}ms):`,
    runners.map((r) => r.source).join(", ")
  );

  const race = await raceScrapersForExactMatch(
    runners,
    exactQuery,
    vision,
    (source, run, q, v, opts) =>
      runScraperWithRetry(source, run, q, v, opts),
    (source) =>
      source === "apify" ? { queryChain: expansionChain } : {},
    scoreResult
  );

  console.log(
    `[MasterScraper] Race finished in ${race.raceElapsedMs}ms` +
      (race.exactFoundAtMs != null
        ? ` (exact at ${race.exactFoundAtMs}ms)`
        : " (no exact)")
  );

  const candidates = race.candidates;
  const anyScraperTimedOut = race.anyTimedOut;

  if (candidates.length === 0) {
    logNoExactMatchWarning(vision, queryPlan, null, []);
    console.log(
      "[MasterScraper] No scraper returned vision-consistent data — caller should use vision fallback",
      anyScraperTimedOut ? "(some scrapers timed out)" : ""
    );
    return null;
  }

  const winner = race.exactWinner ?? candidates[0];
  const matchScore = winner.score;
  const matchConfidence = confidenceFromScore(matchScore);

  if (winner.product.isExactMatch !== true) {
    console.log(
      `[MasterScraper] WINNER (similar): ${winner.source} (score=${winner.score}) — ${winner.reasons.join(", ")}`
    );
  }
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
  if (
    matchScore < HIGH_CONFIDENCE_THRESHOLD &&
    raw.isExactMatch !== true
  ) {
    console.warn(
      `[MasterScraper] Score ${matchScore} below threshold ${HIGH_CONFIDENCE_THRESHOLD} — keeping as similar`
    );
    raw = { ...raw, isExactMatch: false, matchType: "similar" };
  }

  logNoExactMatchWarning(vision, queryPlan, raw, candidates);

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
