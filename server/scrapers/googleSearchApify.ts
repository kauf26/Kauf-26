/**
 * Uses apify/google-search-scraper — query expansion until exact match or chain exhausted.
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  logListingRankDiagnostics,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { buildQueryExpansionChain } from "./queryExpansion";
import { bestPriceFromText } from "./priceFromText";
import {
  isAbortError,
  type ScraperRunOptions,
  raceWithAbortSignal,
  throwIfAborted,
} from "./scraperOptions";
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
  context?: VisionMatchContext,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  throwIfAborted(signal, "googleSearchApify");
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

  const run = await raceWithAbortSignal(
    client.actor(actorId).call(input, { waitSecs: RUN_TIMEOUT_SECS }),
    signal
  );

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

  logListingRankDiagnostics(listings, matchCtx, {
    label: "GoogleSearchApify",
    searchQuery: q,
    limit: 5,
  });

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
    searchQueryUsed: q,
  };
}

export async function scrapeViaGoogleSearch(
  _query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> {
  const signal = opts?.signal;
  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[GoogleSearchApify] APIFY_API_KEY missing — skipping");
    return null;
  }

  const visionTitle = context?.visionTitle?.trim() || _query.trim();
  const visionBrand = context?.visionBrand?.trim();
  const queryChain =
    opts?.queryChain ??
    buildQueryExpansionChain(visionTitle, visionBrand);

  console.log(
    `[GoogleSearchApify] Query expansion chain (${queryChain.length}):`,
    queryChain.map((q, i) => `${i + 1}. "${q}"`).join(" | ")
  );

  let lastResult: Record<string, unknown> | null = null;

  try {
    for (let i = 0; i < queryChain.length; i++) {
      throwIfAborted(signal, "googleSearchApify");
      const q = queryChain[i];
      console.log(
        `[GoogleSearchApify] Attempt ${i + 1}/${queryChain.length}: "${q}"`
      );
      const result = await runGoogleSearch(q, visionTitle, context, signal);
      if (!result) continue;

      lastResult = result;

      if (result.isExactMatch === true) {
        console.log(
          `[GoogleSearchApify] Exact match on attempt ${i + 1} — "${result.title}"`
        );
        return result;
      }
    }

    if (lastResult) {
      lastResult.isExactMatch = false;
      lastResult.matchType = "similar";
      console.log(
        `[GoogleSearchApify] No exact after ${queryChain.length} queries — returning best similar`
      );
    }

    return lastResult;
  } catch (err) {
    if (isAbortError(err)) {
      console.log(
        "[GoogleSearchApify] Aborted — parallel race exact match won elsewhere"
      );
      throw err;
    }
    console.error("[GoogleSearchApify] Error:", err);
    return null;
  }
}
