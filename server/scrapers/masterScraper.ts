import {
  extractProductData as scrapeOpenAI,
  inferPriceFromDescription,
} from "./openai";
import { scrapeProduct as scrapeApify } from "./apify";
import { scrapeProduct as scrapeOxylabs } from "./oxylabs";
import { scrapeProduct as scrapeRapidAPI } from "./rapidapi";
import dotenv from 'dotenv';
dotenv.config();

export const PHONE_TITLE_REGEX =
  /\b(\w*phone\w*|iphone|android|samsung|galaxy|pixel|smartphone|cell\s*phone)\b/i;

const truncateDescription = (text: string, query: string): string => {
  if (!text || text.trim() === "") return ""; 
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

function parsePrice(price: any): number {
  const str = String(price).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0.00 : parsed;
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

/** Temporary: fix Watches when title clearly describes a phone */
export function correctMisclassifiedCategory(
  product: Record<string, unknown>
): Record<string, unknown> {
  const title = String(product.title ?? "");
  const category = String(product.category ?? "");
  const phoneLike = PHONE_TITLE_REGEX.test(title);
  if (phoneLike && category !== "Electronics") {
    return { ...product, category: "Electronics" };
  }
  return product;
}

// Logic: If result is clearly a placeholder, return null instead of a generic object
function validateProduct(data: any): boolean {
  if (!data || !data.title || data.title === "N/A") return false;
  // If price is 0 and description is missing/generic, treat as failure
  if (parsePrice(data.price) === 0 && (!data.description || data.description.length < 10)) return false;
  return true;
}

/**
 * Every successful scrape returns isExactMatch:
 * - true: a marketplace scraper returned validated listing data (winner path).
 * - false: OpenAI fallback only — inferred fields, needs manual review on draft.
 */
function buildScrapedProduct(
  data: Record<string, unknown>,
  isExactMatch: boolean,
  query: string
) {
  return correctMisclassifiedCategory({
    ...data,
    price: parsePrice(data.price),
    description: truncateDescription(String(data.description ?? ""), query),
    isExactMatch,
  });
}

export const scrapeProduct = async (query: string): Promise<any | null> => {
  console.log(`[MasterScraper] Initiating search for: ${query}`);

  // 1. Race specialized scrapers
  const scrapers = [scrapeApify, scrapeOxylabs, scrapeRapidAPI];
  const results = await Promise.allSettled(scrapers.map(s => s(query)));

  const winner = results.find((res): res is PromiseFulfilledResult<any> =>
    res.status === 'fulfilled' && validateProduct(res.value)
  );

  if (winner) {
    console.log(`[MasterScraper] Winner found!`);
    // true = validated marketplace listing, not AI guesswork
    return buildScrapedProduct(winner.value, true, query);
  }

  // 2. Fallback to OpenAI
  console.log("[MasterScraper] Specialized scrapers failed. Falling back to OpenAI...");
  try {
    const aiData = await scrapeOpenAI(query);
    if (validateProduct(aiData)) {
      const price = resolveOpenAIFallbackPrice(aiData);
      // false = AI-inferred product; user should verify on draft
      return buildScrapedProduct(
        {
          title: aiData.title,
          brand: aiData.brand || "N/A",
          price,
          description: aiData.description,
          category: String(aiData.category ?? "").trim() || "Other",
          condition: aiData.condition || "New",
        },
        false,
        query
      );
    }
  } catch (error) {
    console.error('❌ AI Fallback failed:', error);
  }

  // RETURN NULL: This forces the API route to trigger the 404/422 handling 
  // instead of saving a blank "General" item.
  console.log("[MasterScraper] No valid data found for query.");
  return null;
};
