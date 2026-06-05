import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeGoogle } from "./googleShopping";
import {
  scrapeProduct as scrapeGoogleLens,
  lensVisualExactProduct,
} from "./googleLens";
import {
  buildBroadMarketplaceQuery,
  buildExactMarketplaceQuery,
} from "./marketplaceQuery";
import { buildQueryExpansionChain } from "./queryExpansion";
import {
  extractModelNumbers,
  optimizeSearchTerm,
} from "./searchOptimizer";
import {
  GLOBAL_EXACT_RACE_TIMEOUT_MS,
  SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS,
  SCRAPER_RACE_WINDOW_MS,
  raceScrapersForExactMatch,
  type ScraperRunner,
} from "./scraperRace";
import {
  isAbortError,
  type ScraperRunOptions,
} from "./scraperOptions";
import {
  buildMatchContext,
  listingExactRank,
  type ListingRankDiagnostic,
} from "./visionMatch";
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

/** Total scrape budget after vision (Lens + keyword stage) */
const SCRAPE_BUDGET_MS = Number(process.env.SCRAPE_BUDGET_MS ?? 50_000);

const SCRAPER_TIMEOUT_MS: Record<ScraperSource, number> = {
  apify: Number(process.env.APIFY_SCRAPER_TIMEOUT_MS ?? 40_000),
  googleLens: Number(process.env.GOOGLE_LENS_TIMEOUT_MS ?? 4_000),
  google: Number(process.env.GOOGLE_SHOPPING_TIMEOUT_MS ?? 3_000),
  ebay: 3_000,
  rapidapi: 3_000,
  openai: 3_000,
  oxylabs: 3_000,
};

const GOOGLE_LENS_PHASE_TIMEOUT_MS = Number(
  process.env.GOOGLE_LENS_TIMEOUT_MS ?? 15_000
);

/** Minimum ms reserved for Stage 2 after Lens (Lens timeout must not consume entire scrape budget) */
const KEYWORD_STAGE_MIN_BUDGET_MS = Number(
  process.env.KEYWORD_STAGE_MIN_BUDGET_MS ?? GLOBAL_EXACT_RACE_TIMEOUT_MS
);

/** Stage 2 rank threshold for exact match (default 50; env EXACT_MATCH_MIN_RANK) */
const EXACT_MATCH_RANK_THRESHOLD = Number(
  process.env.EXACT_MATCH_MIN_RANK ?? 50
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

  if (
    scraperData.scraperSource === "googleLens" ||
    scraperData.visualSearchLead === true
  ) {
    score += 70;
    reasons.push("visual_search_lead");
  }

  return { score, reasons };
}

function listingRowFromProduct(
  product: Record<string, unknown>
): {
  title: string;
  brand: string;
  description: string;
  url: string;
  price: unknown;
} {
  return {
    title: String(product.title ?? ""),
    brand: String(product.brand ?? ""),
    description: String(product.description ?? ""),
    url: String(product.productUrl ?? product.url ?? product.link ?? ""),
    price: product.price,
  };
}

/** Log vision exactRank for each listing/candidate (masterScraper threshold). */
function logListingExactRanks(
  items: Array<{ label: string; product: Record<string, unknown> }>,
  ctx: VisionMatchContext,
  threshold: number
): void {
  console.log(
    `[MasterScraper] exactRank per listing (threshold=${threshold}) visionTitle="${ctx.visionTitle}"`
  );
  for (const { label, product } of items) {
    const rank = listingExactRank(listingRowFromProduct(product), ctx);
    console.log(
      `[MasterScraper]   ${label}: exactRank=${rank} meetsThreshold=${rank >= threshold} isExactMatch=${product.isExactMatch === true} scraperSource=${String(product.scraperSource ?? "n/a")} title="${String(product.title ?? "").slice(0, 100)}"`
    );
  }
}

function lensQualifiesAsExact(lensRaw: Record<string, unknown>): boolean {
  return (
    lensRaw.isExactMatch === true || lensVisualExactProduct(lensRaw)
  );
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
    productUrl: String(
      data.productUrl ?? data.url ?? data.link ?? ""
    ).trim(),
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
    productUrl: String(
      scraped.productUrl ?? scraped.url ?? scraped.link ?? ""
    ).trim(),
    isExactMatch: false,
    matchType: "similar" satisfies MatchType,
    scraperSource: scraped.scraperSource,
    needsManualReview: true,
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
    try {
      const softTimeoutMs =
        opts?.timeoutMs ??
        SCRAPER_TIMEOUT_MS[source] ??
        SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS;
      const hardDeadlineMs =
        opts?.raceDeadlineMs ?? softTimeoutMs;

      let softTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (hardDeadlineMs > softTimeoutMs) {
          softTimer = setTimeout(() => {
            if (!timedOut) {
              timedOut = true;
              console.warn(
                `[MasterScraper] ${source} soft timeout at ${softTimeoutMs}ms — ` +
                  `waiting until race deadline ${hardDeadlineMs}ms`
              );
            }
          }, softTimeoutMs);
        }

        const value = await withTimeout(
          run(query, vision, opts),
          hardDeadlineMs,
          `${source}#${attempt}`
        );

        const elapsedMs = Date.now() - t0;
        const exact =
          value &&
          typeof value === "object" &&
          (value as Record<string, unknown>).isExactMatch === true;
        console.log(
          `[MasterScraper] ${source} ok in ${elapsedMs}ms` +
            (exact ? " (exact match)" : "")
        );
        return {
          source,
          value,
          timedOut,
          aborted: false,
          elapsedMs,
        };
      } finally {
        if (softTimer) clearTimeout(softTimer);
      }
    } catch (err) {
      if (isAbortError(err)) {
        const elapsedMs = Date.now() - t0;
        console.log(`[MasterScraper] ${source} aborted in ${elapsedMs}ms`);
        return {
          source,
          value: null,
          timedOut: false,
          aborted: true,
          elapsedMs,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("timed out")) timedOut = true;
      const elapsedMs = Date.now() - t0;
      console.warn(
        `[MasterScraper] ${source} ${timedOut ? "timeout" : "failed"} in ${elapsedMs}ms:`,
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

/** Keyword scrapers: fire each optimized query in parallel, keep best / first exact */
function wrapParallelOptimizedQueries(
  source: ScraperSource,
  run: ScraperRunner["run"],
  queryStrings: string[]
): ScraperRunner["run"] {
  if (source === "apify") {
    return async (primary, vision, opts) => {
      console.log(
        `[MasterScraper] apify query chain (${queryStrings.length}):`,
        queryStrings.join(" | ")
      );
      const raw = await run(primary, vision, {
        ...opts,
        queryChain: queryStrings,
      });
      console.log(
        `[MasterScraper] apify chain → ${raw ? "result" : "empty"}` +
          (raw
            ? ` title="${String(raw.title ?? "").slice(0, 60)}" isExact=${raw.isExactMatch === true}`
            : "")
      );
      return raw;
    };
  }

  return async (_primary, vision, opts) => {
    const ctx: VisionMatchContext = vision ?? {
      visionTitle: _primary,
      visionBrand: "",
    };
    if (queryStrings.length === 0) return null;
    if (queryStrings.length === 1) {
      return run(queryStrings[0], ctx, opts);
    }

    const outcomes = await Promise.all(
      queryStrings.map(async (q) => {
        try {
          const raw = await run(q, ctx, opts);
          console.log(
            `[MasterScraper] ${source} query "${q}" → ${raw ? "result" : "empty"}` +
              (raw
                ? ` title="${String(raw.title ?? "").slice(0, 60)}" isExact=${raw.isExactMatch === true}`
                : "")
          );
          return raw;
        } catch (err) {
          console.log(
            `[MasterScraper] ${source} query "${q}" → error:`,
            err instanceof Error ? err.message : err
          );
          return null;
        }
      })
    );

    let best: Record<string, unknown> | null = null;
    let bestScore = -1;

    console.log(
      `[MasterScraper] ${source} parallel queries=${queryStrings.length} withResults=${outcomes.filter(Boolean).length}`
    );

    for (const raw of outcomes) {
      if (!raw || !validateProduct(raw)) continue;
      if (raw.isExactMatch === true) return raw;
      const { score } = scoreResult(ctx, raw);
      if (score > bestScore) {
        bestScore = score;
        best = raw;
      }
    }
    return best;
  };
}

export const scrapeProduct = async (
  query: string,
  options?: ScrapeOptions
): Promise<Record<string, unknown> | null> => {
  try {
  const visionInput: VisionMatchContext = options?.vision ?? {
    visionTitle: query,
    visionBrand: "",
  };
  const optimizedQueries = optimizeSearchTerm(
    visionInput.visionTitle || query,
    visionInput.visionBrand
  );
  const modelNumbers = extractModelNumbers(
    visionInput.visionTitle || query
  );
  const matchVision = buildMatchContext(
    visionInput.visionTitle,
    visionInput.visionBrand,
    {
      ...visionInput,
      modelNumbers,
    }
  );

  const manualQuery = options?.searchQuery?.trim();
  const exactQuery =
    manualQuery || buildExactMarketplaceQuery(query, matchVision.visionBrand);
  const broadQuery = buildBroadMarketplaceQuery(query, matchVision.visionBrand);

  const keywordQueries = manualQuery
    ? [
        manualQuery,
        ...optimizedQueries.filter(
          (q) => q.toLowerCase() !== manualQuery.toLowerCase()
        ),
      ].slice(0, 3)
    : optimizedQueries.length > 0
      ? optimizedQueries
      : buildQueryExpansionChain(query, matchVision.visionBrand).slice(0, 3);

  const expansionChain = [
    ...keywordQueries,
    ...buildQueryExpansionChain(query, matchVision.visionBrand).filter(
      (q) => !keywordQueries.some((o) => o.toLowerCase() === q.toLowerCase())
    ),
  ];

  const queryPlan = {
    exact: exactQuery,
    broad: broadQuery,
    optimized: keywordQueries,
    modelNumbers,
    expansionChain,
  };
  console.log("[MasterScraper] Search plan:", JSON.stringify(queryPlan, null, 2));

  const scrapeBudgetStart = Date.now();
  const scrapeRemainingMs = () =>
    Math.max(0, SCRAPE_BUDGET_MS - (Date.now() - scrapeBudgetStart));

  const lensBase64 = options?.imageBase64?.trim();
  if (lensBase64 && process.env.APIFY_API_KEY?.trim() && scrapeRemainingMs() > 0) {
    const keywordReserveMs = Math.min(
      KEYWORD_STAGE_MIN_BUDGET_MS,
      scrapeRemainingMs()
    );
    const lensTimeoutMs = Math.min(
      GOOGLE_LENS_PHASE_TIMEOUT_MS,
      Math.max(0, scrapeRemainingMs() - keywordReserveMs)
    );

    if (lensTimeoutMs < 500) {
      console.log(
        `[MasterScraper] Stage 1 Lens skipped — reserving ${keywordReserveMs}ms for Stage 2 (total budget ${SCRAPE_BUDGET_MS}ms)`
      );
    } else {
    const lensStart = Date.now();
    console.log(
      `[MasterScraper] Stage 1: Google Lens visual exact-match (${lensTimeoutMs}ms cap, ${keywordReserveMs}ms reserved for Stage 2)`
    );
    try {
      const lensRaw = await withTimeout(
        scrapeGoogleLens(exactQuery, matchVision, {
          imageBase64: lensBase64,
          imageMimeType: options?.imageMimeType ?? "image/jpeg",
        }),
        lensTimeoutMs,
        "googleLens-phase"
      );

      if (lensRaw) {
        logListingExactRanks(
          [{ label: "googleLens-stage1", product: lensRaw }],
          matchVision,
          EXACT_MATCH_RANK_THRESHOLD
        );
        console.log(
          `[MasterScraper] Stage 1 Lens flags: isExactMatch=${lensRaw.isExactMatch === true} visualExact=${lensVisualExactProduct(lensRaw)}`
        );
      }

      if (lensRaw && lensQualifiesAsExact(lensRaw)) {
        const listingBrand = String(lensRaw.brand ?? "");
        const listingTitle = String(lensRaw.title ?? "");
        if (!brandsConflict(matchVision.visionBrand, listingBrand, listingTitle)) {
          const lensMs = Date.now() - lensStart;
          console.log(
            `[MasterScraper] Stage 1 WIN — googleLens exact (isExactMatch=${lensRaw.isExactMatch === true}) in ${lensMs}ms; skipping keyword scrapers`
          );
          const lensLead = {
            ...lensRaw,
            scraperSource: "googleLens",
            visualSearchLead: true,
            isExactMatch: true,
            matchType: "exact",
          };
          const scored = scoreResult(matchVision, lensLead);
          return attachScrapeMeta(buildExactProduct(lensLead, query), {
            timedOut: false,
            matchConfidence: confidenceFromScore(scored.score),
            matchScore: scored.score,
          });
        }
        console.warn(
          "[MasterScraper] Google Lens brand conflict — Stage 2 keyword race"
        );
      } else {
        console.log(
          `[MasterScraper] Stage 1: no visual product URL (${Date.now() - lensStart}ms) — Stage 2`
        );
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.warn(
          "[MasterScraper] Google Lens failed or timed out — continuing to Stage 2:",
          err instanceof Error ? err.message : err
        );
      } else {
        console.log(
          "[MasterScraper] Google Lens aborted — continuing to Stage 2 if budget remains"
        );
      }
    }
    }
  }

  const stage2RemainingMs = scrapeRemainingMs();
  if (stage2RemainingMs <= 0) {
    console.log(
      `[MasterScraper] Scrape budget ${SCRAPE_BUDGET_MS}ms exhausted after Stage 1 — no Stage 2`
    );
    return null;
  }

  console.log(
    `[MasterScraper] Stage 2 (${stage2RemainingMs}ms left) queries:`,
    keywordQueries.join(" | ")
  );

  const runners: ScraperRunner[] = [
    {
      source: "apify",
      run: wrapParallelOptimizedQueries(
        "apify",
        scrapeApify,
        keywordQueries
      ),
    },
    {
      source: "google",
      run: wrapParallelOptimizedQueries(
        "google",
        scrapeGoogle,
        keywordQueries
      ),
    },
  ];

  console.log(
    `[MasterScraper] Stage 2 race (${runners.length} scrapers, ${SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS}ms per source, ${SCRAPER_RACE_WINDOW_MS}ms window):`,
    runners.map((r) => r.source).join(", ")
  );

  const race = await raceScrapersForExactMatch(
    runners,
    exactQuery,
    matchVision,
    (source, run, q, v, opts) =>
      runScraperWithRetry(source, run, q, v, opts),
    (source) => ({
      timeoutMs:
        SCRAPER_TIMEOUT_MS[source] ?? SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS,
      raceDeadlineMs: SCRAPER_RACE_WINDOW_MS,
    }),
    scoreResult
  );

  console.log(
    `[MasterScraper] Race finished in ${race.raceElapsedMs}ms` +
      (race.exactFoundAtMs != null
        ? ` (exact at ${race.exactFoundAtMs}ms)`
        : " (no exact)") +
      ` candidates=${race.candidates.length}`
  );
  for (const c of race.candidates) {
    console.log(
      `[MasterScraper] Race result ${c.source}: score=${c.score} isExact=${c.product.isExactMatch === true} ` +
        `matchValidation=${String(c.product.matchValidation ?? "n/a")} title="${String(c.product.title ?? "").slice(0, 80)}"`
    );
  }

  const candidates = race.candidates;
  const anyScraperTimedOut = race.anyTimedOut;

  if (candidates.length === 0) {
    logNoExactMatchWarning(matchVision, queryPlan, null, []);
    console.log(
      "[MasterScraper] No scraper candidates — returning vision similar fallback with needsManualReview",
      anyScraperTimedOut ? "(some scrapers timed out)" : ""
    );
    const fallback = mergeSimilarProduct(
      {
        title: matchVision.visionTitle || query,
        brand: matchVision.visionBrand ?? "",
        description: `Similar match for ${matchVision.visionTitle || query}. Details pending manual review.`,
        price: 0,
        scraperSource: "openai",
      },
      { visionTitle: matchVision.visionTitle }
    );
    return attachScrapeMeta(fallback, {
      timedOut: anyScraperTimedOut,
      matchConfidence: "low",
      matchScore: 0,
    });
  }

  logListingExactRanks(
    candidates.map((c, i) => ({
      label: `stage2-candidate-${i + 1}-${c.source}`,
      product: c.product,
    })),
    matchVision,
    EXACT_MATCH_RANK_THRESHOLD
  );

  let winner = race.exactWinner ?? candidates[0];
  let raw = winner.product;

  if (raw.isExactMatch !== true) {
    const rank = listingExactRank(listingRowFromProduct(raw), matchVision);
    console.log(
      `[MasterScraper] Stage 2 winner pre-rank: exactRank=${rank} threshold=${EXACT_MATCH_RANK_THRESHOLD}`
    );
    if (rank >= EXACT_MATCH_RANK_THRESHOLD) {
      raw = { ...raw, isExactMatch: true, matchType: "exact" };
      winner = { ...winner, product: raw };
      console.log(
        `[MasterScraper] Stage 2 exact via rank=${rank} (threshold ${EXACT_MATCH_RANK_THRESHOLD})`
      );
    } else {
      console.log(
        `[MasterScraper] Stage 2 winner below exact threshold: rank=${rank} < ${EXACT_MATCH_RANK_THRESHOLD}`
      );
    }
  } else {
    console.log(
      `[MasterScraper] Stage 2 winner already exact (isExactMatch=true, source=${winner.source})`
    );
  }

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

  raw = winner.product;
  if (
    matchScore < HIGH_CONFIDENCE_THRESHOLD &&
    raw.isExactMatch !== true
  ) {
    console.warn(
      `[MasterScraper] Score ${matchScore} below threshold ${HIGH_CONFIDENCE_THRESHOLD} — keeping as similar`
    );
    raw = { ...raw, isExactMatch: false, matchType: "similar" };
  }

  logNoExactMatchWarning(matchVision, queryPlan, raw, candidates);

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
    visionTitle: matchVision.visionTitle,
    visionCategory: undefined,
  });
  console.log(
    "[MasterScraper] Returning similar match (needsManualReview=true) — no exact winner"
  );
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
  } catch (err) {
    console.error(
      "[MasterScraper] scrapeProduct failed — returning null (vision-only identify will continue):",
      err instanceof Error ? err.message : err
    );
    return null;
  }
};
