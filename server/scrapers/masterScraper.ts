import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeGoogle } from "./googleShopping";
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

export type ScrapeOptions = {
  vision?: VisionMatchContext;
};

const truncateDescription = (text: string, query: string): string => {
  if (!text || text.trim() === "") return "";
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

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

/**
 * Similar listing from marketplace (not exact SKU).
 * Enriches description with color/material when present.
 */
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

/** OpenAI text extraction — generic match type */
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
    { source: "google", run: scrapeGoogle },
    { source: "openai", run: runOpenAIScraper },
  ];

  console.log(
    `[MasterScraper] Running ${runners.length} scrapers in parallel:`,
    runners.map((r) => r.source).join(", ")
  );

  const results = await Promise.allSettled(
    runners.map(async ({ source, run }) => {
      const value = await run(query, vision);
      return { source, value };
    })
  );

  type Candidate = {
    source: ScraperSource;
    product: Record<string, unknown>;
    score: number;
    reasons: string[];
  };

  const candidates: Candidate[] = [];

  for (const res of results) {
    if (res.status !== "fulfilled") {
      console.warn("[MasterScraper] Scraper rejected:", res.reason);
      continue;
    }
    const { source, value } = res.value;
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

    const { score, reasons } = scoreScraperCandidate(value, vision);
    console.log(
      `[MasterScraper] ${source}: score=${score} [${reasons.join(", ")}]`
    );
    candidates.push({
      source,
      product: { ...value, scraperSource: source },
      score,
      reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    console.log(
      "[MasterScraper] No scraper returned vision-consistent data — caller should use vision fallback"
    );
    return null;
  }

  const winner = candidates[0];
  console.log(
    `[MasterScraper] WINNER: ${winner.source} (score=${winner.score}) — ${winner.reasons.join(", ")}`
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

  const raw = winner.product;
  if (raw.isExactMatch === true) {
    const result = buildExactProduct(raw, query);
    console.log("[MasterScraper] Price stats:", {
      price: result.price,
      priceReliable: result.priceReliable,
      isExactMatch: result.isExactMatch,
      scraperSource: result.scraperSource,
    });
    return result;
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
  });
  return result;
};
