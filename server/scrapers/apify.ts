// server/scrapers/apify.ts
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { scrapeViaGoogleSearch } from "./googleSearchApify";
import {
  isAbortError,
  raceWithAbortSignal,
  type ScraperRunOptions,
  throwIfAborted,
} from "./scraperOptions";
import dotenv from "dotenv";

dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

const ECOMMERCE_ACTOR_ID = "apify/e-commerce-scraping-tool";
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? 3);

const LOG_SAMPLE_ITEMS = 3;

function getEcommerceActorId(): string {
  const id = process.env.APIFY_ACTOR_ID?.trim();
  if (!id || id.includes("google-search")) return ECOMMERCE_ACTOR_ID;
  return id;
}

/** Official input for apify/e-commerce-scraping-tool */
function buildEcommerceActorInput(query: string): Record<string, unknown> {
  return {
    searchEngineKeyword: query,
    scrapeProductsFromSearchEngine: true,
    maxSearchEngineResults: SCRAPE_LISTING_LIMIT,
    maxSearchEngineProducts: SCRAPE_LISTING_LIMIT,
    scrapeMode: "AUTO",
    countryCode: "us",
    scrapeModeSearchEngine: "Google Listing",
  };
}

function extractBrand(raw: Record<string, unknown>): string {
  const brand = raw.brand;
  if (typeof brand === "string") return brand.trim();
  if (brand && typeof brand === "object") {
    const b = brand as Record<string, unknown>;
    return String(b.name ?? b.slogan ?? "").trim();
  }
  return String(raw.brandName ?? raw.name ?? "").trim();
}

function extractPrice(raw: Record<string, unknown>): unknown {
  const offers = raw.offers;
  if (offers && typeof offers === "object") {
    const o = offers as Record<string, unknown>;
    if (o.price != null) return o.price;
    if (Array.isArray(o)) {
      const first = (o as unknown[])[0] as Record<string, unknown> | undefined;
      if (first?.price != null) return first.price;
    }
  }
  return raw.price ?? raw.currentPrice ?? raw.listPrice;
}

function normalizeApifyItem(raw: Record<string, unknown>): RawListing {
  const title = String(raw.name ?? raw.title ?? "").trim();
  const description = String(raw.description ?? "").trim();
  return {
    title,
    brand: extractBrand(raw),
    price: extractPrice(raw),
    description,
    category: String(raw.category ?? "").trim(),
    condition: String(raw.condition ?? "").trim(),
  };
}

async function scrapeEcommerceTool(
  query: string,
  context?: VisionMatchContext,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  throwIfAborted(signal, "apify-ecommerce");
  const actorId = getEcommerceActorId();
  const input = buildEcommerceActorInput(query);

  console.log(`[Apify/Ecommerce] Actor: ${actorId}`);
  console.log("[Apify/Ecommerce] Input:", JSON.stringify(input, null, 2));

  const run = await raceWithAbortSignal(
    client.actor(actorId).call(input, { waitSecs: RUN_TIMEOUT_SECS }),
    signal
  );

  console.log("[Apify/Ecommerce] Run:", run.status, run.id);

  const { items: datasetItems } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: SCRAPE_LISTING_LIMIT });

  console.log(`[Apify/Ecommerce] Dataset count: ${datasetItems?.length ?? 0}`);
  if (datasetItems?.length) {
    console.log(
      `[Apify/Ecommerce] Raw (first ${LOG_SAMPLE_ITEMS}):`,
      JSON.stringify(datasetItems.slice(0, LOG_SAMPLE_ITEMS), null, 2)
    );
  }

  const listings = (datasetItems ?? [])
    .map((x) => normalizeApifyItem(x as Record<string, unknown>))
    .filter((row) => (row.title ?? "").length > 0 && row.price != null);

  if (listings.length === 0) {
    console.warn("[Apify/Ecommerce] No titled+priced listings");
    return null;
  }

  const aggregated = aggregateListings(listings, query, context);
  if (!aggregated) return null;

  return { ...aggregated, scraperSource: "apify" };
}

export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> => {
  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[Apify] APIFY_API_KEY missing — skipping");
    return null;
  }

  try {
    throwIfAborted(opts?.signal, "apify");
    const google = await scrapeViaGoogleSearch(query, context, opts);
    if (google) return google;

    throwIfAborted(opts?.signal, "apify");
    console.log("[Apify] Google Search actor empty — trying e-commerce tool");
    return await scrapeEcommerceTool(query, context, opts?.signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error("❌ Apify Error:", error);
    return null;
  }
};
