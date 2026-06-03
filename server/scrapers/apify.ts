// server/scrapers/apify.ts
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import dotenv from "dotenv";

dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

const DEFAULT_ACTOR_ID = "apify/e-commerce-scraping-tool";
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? 120);

const truncateDescription = (text: string, query: string): string => {
  if (!text) return `A general listing for ${query}.`;
  const words = text.split(/\s+/);
  return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

function getActorId(): string {
  const id = process.env.APIFY_ACTOR_ID?.trim();
  if (!id) {
    console.warn(
      `[Apify] APIFY_ACTOR_ID not set — using default ${DEFAULT_ACTOR_ID}`
    );
    return DEFAULT_ACTOR_ID;
  }
  return id;
}

/** Actor input for apify/e-commerce-scraping-tool */
function buildActorInput(query: string): Record<string, unknown> {
  return {
    search: query,
    limit: SCRAPE_LISTING_LIMIT,
    scrapeMode: "AUTO",
  };
}

const LOG_SAMPLE_ITEMS = 3;

function extractBrand(raw: Record<string, unknown>): string {
  const brand = raw.brand;
  if (typeof brand === "string") return brand.trim();
  if (brand && typeof brand === "object") {
    const b = brand as Record<string, unknown>;
    return String(b.name ?? b.slogan ?? "").trim();
  }
  return String(raw.brandName ?? "").trim();
}

function extractPrice(raw: Record<string, unknown>): unknown {
  const offers = raw.offers;
  if (offers && typeof offers === "object") {
    const o = offers as Record<string, unknown>;
    if (o.price != null) return o.price;
  }
  const product = raw.product;
  if (product && typeof product === "object") {
    const p = product as Record<string, unknown>;
    if (p.price != null) return p.price;
    const pOffers = p.offers;
    if (pOffers && typeof pOffers === "object") {
      return (pOffers as Record<string, unknown>).price;
    }
  }
  return raw.price ?? raw.currentPrice ?? raw.listPrice;
}

function normalizeApifyItem(raw: Record<string, unknown>): RawListing {
  const product =
    raw.product && typeof raw.product === "object"
      ? (raw.product as Record<string, unknown>)
      : undefined;

  const title = String(
    raw.title ?? raw.name ?? product?.title ?? product?.name ?? ""
  ).trim();

  const description = String(
    raw.description ?? product?.description ?? ""
  ).trim();

  const category = String(
    raw.category ?? raw.productCategory ?? product?.category ?? ""
  ).trim();

  const condition = String(
    raw.condition ?? raw.itemCondition ?? "Used"
  ).trim();

  return {
    title,
    brand: extractBrand(raw) || extractBrand(product ?? {}),
    price: extractPrice(raw),
    description,
    category,
    condition,
  };
}

function collectRawItems(
  datasetItems: unknown[],
  runRecord: Record<string, unknown> | null
): Record<string, unknown>[] {
  const fromDataset = datasetItems.filter(
    (x): x is Record<string, unknown> => !!x && typeof x === "object"
  );
  if (fromDataset.length > 0) return fromDataset;

  if (!runRecord) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(runRecord.items)) candidates.push(...runRecord.items);
  if (Array.isArray(runRecord.results)) candidates.push(...runRecord.results);

  const dataset = runRecord.dataset;
  if (dataset && typeof dataset === "object") {
    const d = dataset as Record<string, unknown>;
    if (Array.isArray(d.items)) candidates.push(...d.items);
  }

  return candidates.filter(
    (x): x is Record<string, unknown> => !!x && typeof x === "object"
  );
}

export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext
): Promise<any> => {
  const actorId = getActorId();

  try {
    if (!process.env.APIFY_API_KEY) {
      console.warn("[Apify] APIFY_API_KEY missing — skipping Apify scraper");
      return getGeneralDescription(query);
    }

    const input = buildActorInput(query);
    console.log(`[Apify] Actor: ${actorId}`);
    console.log("[Apify] Input sent to actor:", JSON.stringify(input, null, 2));

    const run = await client.actor(actorId).call(input, {
      waitSecs: RUN_TIMEOUT_SECS,
    });

    console.log("[Apify] Run finished:", {
      id: run.id,
      status: run.status,
      defaultDatasetId: run.defaultDatasetId,
    });

    const { items: datasetItems } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: SCRAPE_LISTING_LIMIT });

    console.log(
      `[Apify] Dataset item count: ${datasetItems?.length ?? 0}`
    );
    if (datasetItems?.length) {
      const sampleN = Math.min(LOG_SAMPLE_ITEMS, datasetItems.length);
      console.log(
        `[Apify] Raw dataset items (first ${sampleN}):`,
        JSON.stringify(datasetItems.slice(0, LOG_SAMPLE_ITEMS), null, 2)
      );
    }

    let runDetail: Record<string, unknown> | null = null;
    try {
      runDetail = (await client.run(run.id).get()) as unknown as Record<
        string,
        unknown
      >;
    } catch {
      /* optional */
    }

    const rawItems = collectRawItems(datasetItems ?? [], runDetail);
    console.log(`[Apify] Collected raw item count: ${rawItems.length}`);
    if (rawItems.length > 0) {
      const rawSampleN = Math.min(LOG_SAMPLE_ITEMS, rawItems.length);
      console.log(
        `[Apify] Raw items before normalization (first ${rawSampleN}):`,
        JSON.stringify(rawItems.slice(0, LOG_SAMPLE_ITEMS), null, 2)
      );
    }

    const listings = rawItems
      .map(normalizeApifyItem)
      .filter((row) => (row.title ?? "").length > 0);

    if (listings.length > 0) {
      const normSampleN = Math.min(LOG_SAMPLE_ITEMS, listings.length);
      console.log(
        `[Apify] Normalized listings before aggregation (first ${normSampleN}):`,
        JSON.stringify(listings.slice(0, LOG_SAMPLE_ITEMS), null, 2)
      );
    }

    if (listings.length === 0) {
      console.warn("[Apify] No parseable items — falling back to generic");
      return getGeneralDescription(query);
    }

    console.log(
      `[Apify] Parsed ${listings.length} listing(s); priced: ${listings.filter((r) => r.price != null).length}`
    );

    const aggregated = aggregateListings(listings, query, context);
    console.log(
      "[Apify] Aggregated result:",
      JSON.stringify(aggregated, null, 2)
    );
    if (!aggregated) return getGeneralDescription(query);

    return {
      ...aggregated,
      description: truncateDescription(
        String(aggregated.description || ""),
        query
      ),
    };
  } catch (error) {
    console.error("❌ Apify Error:", error);
    return getGeneralDescription(query);
  }
};

function getGeneralDescription(query: string) {
  return {
    title: query,
    brand: "",
    description: "",
    price: undefined,
    category: "",
    condition: "",
    isExactMatch: false,
  };
}
