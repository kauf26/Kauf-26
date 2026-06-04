/**
 * Uses apify/google-search-scraper — exact query first, broad fallback.
 * Match quality comes from vision↔listing scoring, not hardcoded product lists.
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import {
  buildBroadMarketplaceQuery,
  buildExactMarketplaceQuery,
} from "./marketplaceQuery";
import { bestPriceFromText } from "./priceFromText";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_ACTOR = "apify/google-search-scraper";
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? 35);

const PRODUCT_URL_RE =
  /\/(item|listing|product|p|dp|itm|offer|sku|goods)\/|\/\d{6,}|[?&](item|product|sku)=/i;

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

type OrganicResult = {
  title?: string;
  url?: string;
  description?: string;
  displayedUrl?: string;
};

function organicToListing(
  row: OrganicResult,
  visionBrand?: string
): RawListing | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;

  const url = String(row.url ?? "").trim();
  const blob = `${title} ${row.description ?? ""}`;
  const price = bestPriceFromText(blob, 0);
  const looksLikeProduct = PRODUCT_URL_RE.test(url);

  if (price <= 0 && !looksLikeProduct) {
    return null;
  }

  return {
    title,
    brand: visionBrand?.trim() ?? "",
    description: String(row.description ?? "").trim(),
    price: price > 0 ? price : undefined,
    category: "",
    condition: /pre-?owned|used|vintage|refurb/i.test(blob) ? "Used" : "",
    url,
  };
}

async function runGoogleSearch(
  searchQuery: string,
  visionTitle: string,
  context?: VisionMatchContext
): Promise<Record<string, unknown> | null> {
  const actorId =
    process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const q = searchQuery.includes("price") ? searchQuery : `${searchQuery} price`;

  const input = {
    queries: q,
    maxPagesPerQuery: 1,
    resultsPerPage: Math.min(SCRAPE_LISTING_LIMIT + 4, 10),
    languageCode: "en",
    countryCode: "us",
  };

  console.log(`[GoogleSearchApify] Actor: ${actorId} query: "${q}"`);

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
    `[GoogleSearchApify] Run ${run.status}; organic: ${organic.length} for "${q}"`
  );

  const visionBrand = context?.visionBrand?.trim();
  const listings = organic
    .map((r) => organicToListing(r, visionBrand))
    .filter((r): r is RawListing => r != null)
    .slice(0, SCRAPE_LISTING_LIMIT + 2);

  if (listings.length === 0) return null;

  const matchCtx: VisionMatchContext = context ?? {
    visionTitle,
    visionBrand: visionBrand ?? "",
  };

  const aggregated = aggregateListings(listings, visionTitle, matchCtx);
  if (!aggregated) return null;

  const priced = listings.filter((l) => l.price != null).length;
  if (priced < 2) {
    aggregated.priceReliable = false;
    if (!aggregated.price || aggregated.price === 0) {
      const fallback = bestPriceFromText(
        listings.map((l) => `${l.title} ${l.description}`).join(" "),
        0
      );
      if (fallback > 0) {
        aggregated.price = fallback;
        aggregated.ebayAvg = fallback;
        aggregated.allegroAvg = fallback;
      }
    }
  }

  const bestUrl =
    String(aggregated.url ?? aggregated.link ?? "") ||
    listings.find((l) => l.url)?.url ||
    organic[0]?.url ||
    "";

  return {
    ...aggregated,
    scraperSource: "apify",
    link: bestUrl,
    url: bestUrl,
  };
}

export async function scrapeViaGoogleSearch(
  _query: string,
  context?: VisionMatchContext
): Promise<Record<string, unknown> | null> {
  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[GoogleSearchApify] APIFY_API_KEY missing — skipping");
    return null;
  }

  const visionTitle = context?.visionTitle?.trim() || _query.trim();
  const visionBrand = context?.visionBrand?.trim();
  const exactQuery = buildExactMarketplaceQuery(visionTitle, visionBrand);
  const broadQuery = buildBroadMarketplaceQuery(visionTitle, visionBrand);

  try {
    console.log(`[GoogleSearchApify] Phase 1 (exact): "${exactQuery}"`);
    const exactResult = await runGoogleSearch(
      exactQuery,
      visionTitle,
      context
    );
    if (exactResult?.isExactMatch === true) {
      console.log(
        `[GoogleSearchApify] Exact match (${exactResult.exactMatchCount} row(s)) — "${exactResult.title}"`
      );
      return exactResult;
    }

    console.log(`[GoogleSearchApify] Phase 2 (broad): "${broadQuery}"`);
    const broadResult = await runGoogleSearch(
      broadQuery,
      visionTitle,
      context
    );
    if (broadResult) {
      broadResult.isExactMatch = false;
      broadResult.matchType = "similar";
      return broadResult;
    }

    return exactResult;
  } catch (err) {
    console.error("[GoogleSearchApify] Error:", err);
    return null;
  }
}
