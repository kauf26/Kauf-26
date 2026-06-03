// server/scrapers/rapidapi.ts
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type VisionMatchContext,
} from "./listingUtils";

export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext
): Promise<any> => {
  try {
    console.log(`🔎 RapidAPI: Searching for "${query}"...`);

    const url = `https://ebay-data-scraper.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1`;
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': 'ebay-data-scraper.p.rapidapi.com',
      },
    };

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`RapidAPI status ${response.status}`);

    const data = await response.json();
    const items = data.items || data.results || [];

    if (items.length === 0) return getGeneralDescription(query);

    const slice = items.slice(0, SCRAPE_LISTING_LIMIT);
    const aggregated = aggregateListings(slice, query, context);
    if (!aggregated) return getGeneralDescription(query);

    return {
      ...aggregated,
      description: truncateDescription(
        String(aggregated.description || `Listings for ${query}`)
      ),
      category: aggregated.category || "Other",
    };
  } catch (error: any) {
    console.error('❌ RapidAPI scraping error:', error.message || error);
    return getGeneralDescription(query);
  }
};

const truncateDescription = (text: string): string => {
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

const getGeneralDescription = (query: string) => ({
  title: query,
  brand: 'N/A',
  description: `A general listing for "${query}". Details pending manual review.`,
  price: undefined,
  category: 'Other',
  condition: 'New',
  isExactMatch: false,
});
