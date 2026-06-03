import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeOxylabs } from "./oxylabs";
import { scrapeProduct as scrapeRapidAPI } from "./rapidapi";
import dotenv from "dotenv";
dotenv.config();

export type MatchType = "exact" | "similar" | "generic";

const truncateDescription = (text: string, query: string): string => {
  if (!text || text.trim() === "") return "";
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

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
    title: data.title ?? query,
    brand: data.brand ?? "",
    category: String(data.category ?? "").trim() || "Other",
    condition: data.condition ?? "New",
    price,
    allegroAvg: parsePrice(data.allegroAvg ?? data.price),
    ebayAvg: parsePrice(data.ebayAvg ?? data.ebayPrice ?? data.price),
    description: String(data.description ?? ""),
    isExactMatch: true,
    matchType: "exact" satisfies MatchType,
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
  const descParts = [
    scraped.description,
    scraped.color ? `Color: ${scraped.color}` : null,
    scraped.material ? `Material: ${scraped.material}` : null,
  ]
    .filter(Boolean)
    .map(String);
  const description = truncateDescription(
    descParts.join(" ") || `Similar listing match for ${title}.`,
    title
  );

  return {
    ...scraped,
    title,
    brand: scraped.brand ?? "",
    category:
      String(scraped.category ?? context?.visionCategory ?? "").trim() ||
      "Other",
    condition: scraped.condition ?? "Used",
    price: price || allegroAvg || ebayAvg,
    allegroAvg,
    ebayAvg,
    description,
    isExactMatch: false,
    matchType: "similar" satisfies MatchType,
  };
}

/** OpenAI-only fallback — generic description up to 50 words. */
function buildGenericProduct(
  data: Record<string, unknown>,
  query: string
): Record<string, unknown> {
  const price = parsePrice(data.price);
  return {
    ...data,
    title: data.title ?? query,
    brand: data.brand ?? "",
    category: String(data.category ?? "").trim() || "Other",
    condition: data.condition ?? "New",
    price,
    allegroAvg: price,
    ebayAvg: price,
    description: truncateDescription(String(data.description ?? ""), query),
    isExactMatch: false,
    matchType: "generic" satisfies MatchType,
  };
}

export const scrapeProduct = async (query: string): Promise<any | null> => {
  console.log(`[MasterScraper] Initiating search for: ${query}`);

  const scrapers = [scrapeApify, scrapeOxylabs, scrapeRapidAPI];
  const results = await Promise.allSettled(scrapers.map((s) => s(query)));

  const fulfilled = results.filter(
    (res): res is PromiseFulfilledResult<Record<string, unknown>> =>
      res.status === "fulfilled" && validateProduct(res.value)
  );

  const exactWinner = fulfilled.find((res) => res.value.isExactMatch === true);
  if (exactWinner) {
    console.log("[MasterScraper] Exact marketplace match");
    return buildExactProduct(exactWinner.value, query);
  }

  const similarWinner = fulfilled.find(
    (res) => res.value.isExactMatch === false
  );
  if (similarWinner) {
    console.log("[MasterScraper] Similar marketplace match");
    return mergeSimilarProduct(similarWinner.value);
  }

  console.log(
    "[MasterScraper] Specialized scrapers failed. Falling back to OpenAI..."
  );
  try {
    const aiData = await scrapeOpenAI(query);
    if (validateProduct(aiData)) {
      const price = resolveOpenAIFallbackPrice(aiData);
      return buildGenericProduct(
        {
          title: aiData.title,
          brand: aiData.brand || "",
          price,
          description: aiData.description,
          category: String(aiData.category ?? "").trim() || "Other",
          condition: aiData.condition || "New",
        },
        query
      );
    }
  } catch (error) {
    console.error("❌ AI Fallback failed:", error);
  }

  console.log("[MasterScraper] No valid data found for query.");
  return null;
};
