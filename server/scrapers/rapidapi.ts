// server/scrapers/rapidapi.ts
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type VisionMatchContext,
} from "./listingUtils";

export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext
): Promise<Record<string, unknown> | null> => {
  try {
    if (!process.env.RAPIDAPI_KEY?.trim()) {
      console.warn("[RapidAPI] RAPIDAPI_KEY missing — skipping");
      return null;
    }

    console.log(`[RapidAPI] Searching for "${query}"...`);

    const host =
      process.env.RAPIDAPI_EBAY_HOST?.trim() ||
      "any-marketplace-api.p.rapidapi.com";
    const path =
      process.env.RAPIDAPI_EBAY_PATH?.trim() || "/ebay/search?query=";
    const url = path.includes("?")
      ? `https://${host}${path}${encodeURIComponent(query)}`
      : `https://${host}${path}?query=${encodeURIComponent(query)}`;
    const options = {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": host,
      },
    };

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`RapidAPI status ${response.status}`);

    const data = (await response.json()) as {
      items?: unknown[];
      results?: unknown[];
    };
    const items = data.items || data.results || [];

    if (items.length === 0) {
      console.warn("[RapidAPI] No items");
      return null;
    }

    const slice = items.slice(0, SCRAPE_LISTING_LIMIT);
    const aggregated = aggregateListings(
      slice as Parameters<typeof aggregateListings>[0],
      query,
      context
    );
    if (!aggregated) return null;

    console.log(
      `[RapidAPI] Aggregated — title: "${aggregated.title ?? ""}" brand: "${aggregated.brand ?? ""}" price: ${aggregated.price ?? "n/a"}`
    );

    return {
      ...aggregated,
      scraperSource: "rapidapi",
      description: truncateDescription(
        String(aggregated.description || `Listings for ${query}`)
      ),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ RapidAPI scraping error:", msg);
    return null;
  }
};

const truncateDescription = (text: string): string => {
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};
