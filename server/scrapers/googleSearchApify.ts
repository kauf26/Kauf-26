/**
 * Uses apify/google-search-scraper — returns organic results with prices in snippets.
 * Default marketplace data source when APIFY_ACTOR_ID is unset.
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { bestPriceFromText } from "./priceFromText";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_ACTOR = "apify/google-search-scraper";
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? 35);

const MARKETPLACE_HOST_RE =
  /ebay\.|chrono24\.|watchfinder|bobswatches|luxurywatches|jomashop|therealreal|1stdibs|farfetch|grailed/i;

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

type OrganicResult = {
  title?: string;
  url?: string;
  description?: string;
  displayedUrl?: string;
};

function brandFromTitle(title: string, visionBrand?: string): string {
  if (visionBrand?.trim()) return visionBrand.trim();
  const m = title.match(/^([A-Z][a-zA-Z0-9&'.-]+)/);
  return m?.[1]?.trim() ?? "";
}

function organicToListing(
  row: OrganicResult,
  query: string,
  visionBrand?: string
): RawListing | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;

  const blob = `${title} ${row.description ?? ""}`;
  const minPrice = visionBrand ? 100 : 0;
  const price = bestPriceFromText(blob, minPrice);
  if (price <= 0 && !MARKETPLACE_HOST_RE.test(String(row.url ?? ""))) {
    return null;
  }

  return {
    title,
    brand: brandFromTitle(title, visionBrand),
    description: String(row.description ?? "").trim(),
    price: price > 0 ? price : undefined,
    category: "Watches",
    condition: /pre-?owned|used|vintage/i.test(blob) ? "Used" : "",
  };
}

export async function scrapeViaGoogleSearch(
  query: string,
  context?: VisionMatchContext
): Promise<Record<string, unknown> | null> {
  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[GoogleSearchApify] APIFY_API_KEY missing — skipping");
    return null;
  }

  const actorId = process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const searchQuery = query.includes("price") ? query : `${query} price`;

  const input = {
    queries: searchQuery,
    maxPagesPerQuery: 1,
    resultsPerPage: Math.min(SCRAPE_LISTING_LIMIT + 2, 10),
    languageCode: "en",
    countryCode: "us",
  };

  console.log(`[GoogleSearchApify] Actor: ${actorId} query: "${searchQuery}"`);

  try {
    const run = await client.actor(actorId).call(input, {
      waitSecs: RUN_TIMEOUT_SECS,
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 5 });

    const organic: OrganicResult[] = [];
    for (const page of items ?? []) {
      const rows = (page as { organicResults?: OrganicResult[] }).organicResults;
      if (Array.isArray(rows)) organic.push(...rows);
    }

    console.log(
      `[GoogleSearchApify] Run ${run.status}; organic results: ${organic.length}`
    );
    if (organic.length > 0) {
      console.log(
        "[GoogleSearchApify] Sample organic:",
        JSON.stringify(organic.slice(0, 3), null, 2)
      );
    }

    const visionBrand = context?.visionBrand?.trim();
    const listings = organic
      .map((r) => organicToListing(r, searchQuery, visionBrand))
      .filter((r): r is RawListing => r != null)
      .slice(0, SCRAPE_LISTING_LIMIT);

    if (listings.length === 0) {
      console.warn("[GoogleSearchApify] No listings with parseable prices");
      return null;
    }

    const aggregated = aggregateListings(listings, query, context);
    if (!aggregated) return null;

    const priced = listings.filter((l) => l.price != null).length;
    if (priced < 2) {
      console.warn(
        `[GoogleSearchApify] Only ${priced} priced listing(s) — marking price unreliable`
      );
      aggregated.priceReliable = false;
      if (!aggregated.price || aggregated.price === 0) {
        const fallback = bestPriceFromText(
          listings.map((l) => `${l.title} ${l.description}`).join(" "),
          visionBrand ? 100 : 0
        );
        if (fallback > 0) {
          aggregated.price = fallback;
          aggregated.ebayAvg = fallback;
          aggregated.allegroAvg = fallback;
        }
      }
    }

    return {
      ...aggregated,
      scraperSource: "apify",
      link: organic[0]?.url ?? "",
    };
  } catch (err) {
    console.error("[GoogleSearchApify] Error:", err);
    return null;
  }
}
