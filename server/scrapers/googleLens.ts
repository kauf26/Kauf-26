/**
 * Google Lens via Apify prodiger/google-lens-scraper (products mode).
 * Requires a public image URL — uploads capture to Apify KV store using APIFY_API_KEY.
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { bestPriceFromText } from "./priceFromText";
import {
  isAbortError,
  raceWithAbortSignal,
  type ScraperRunOptions,
  throwIfAborted,
} from "./scraperOptions";
import dotenv from "dotenv";

dotenv.config();

const ACTOR_ID =
  process.env.APIFY_GOOGLE_LENS_ACTOR_ID?.trim() ||
  "prodiger/google-lens-scraper";
const RUN_TIMEOUT_SECS = Number(process.env.GOOGLE_LENS_TIMEOUT_SECS ?? 45);

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/** Upload capture so the Lens actor can fetch it over HTTPS */
async function uploadImageToApifyStore(
  base64: string,
  mimeType: string
): Promise<string> {
  const token = process.env.APIFY_API_KEY?.trim();
  if (!token) throw new Error("APIFY_API_KEY missing");

  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  const store = await client.keyValueStores().getOrCreate(
    `kauf26-lens-${Date.now()}`
  );
  const key = `product-image.${extensionForMime(mimeType)}`;

  await client.keyValueStore(store.id).setRecord({
    key,
    value: buffer,
    contentType: mimeType || "image/jpeg",
  });

  return `https://api.apify.com/v2/key-value-stores/${store.id}/records/${encodeURIComponent(key)}?token=${token}`;
}

function normalizeLensRow(raw: Record<string, unknown>): RawListing | null {
  const title = String(
    raw.title ??
      raw.name ??
      raw.productTitle ??
      raw.productName ??
      raw.label ??
      ""
  ).trim();
  if (!title) return null;

  const blob = `${title} ${raw.description ?? ""} ${raw.snippet ?? ""}`;
  const price =
    raw.price ??
    raw.priceText ??
    raw.extractedPrice ??
    (bestPriceFromText(blob, 0) || undefined);

  return {
    title,
    brand: String(raw.brand ?? raw.manufacturer ?? "").trim(),
    description: String(raw.description ?? raw.snippet ?? "").trim(),
    price,
    url: String(raw.url ?? raw.link ?? raw.productUrl ?? "").trim(),
    category: "",
    condition: "",
  };
}

function collectProductListings(items: unknown[]): RawListing[] {
  const listings: RawListing[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const mode = String(
      o.searchType ?? o.mode ?? o.searchMode ?? o.type ?? ""
    ).toLowerCase();
    if (mode && !["products", "product"].includes(mode)) {
      return;
    }

    const nested = [
      o.products,
      o.productResults,
      o.results,
      o.items,
      o.matches,
      o.visualMatches,
    ];
    let expanded = false;
    for (const block of nested) {
      if (Array.isArray(block) && block.length > 0) {
        expanded = true;
        for (const row of block) {
          if (row && typeof row === "object") {
            const listing = normalizeLensRow(row as Record<string, unknown>);
            if (listing) listings.push(listing);
          }
        }
      }
    }

    if (!expanded) {
      const listing = normalizeLensRow(o);
      if (listing) listings.push(listing);
    }
  };

  for (const item of items) {
    visit(item);
  }

  return listings.slice(0, SCRAPE_LISTING_LIMIT + 4);
}

export async function scrapeProduct(
  _query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> {
  const signal = opts?.signal;
  const base64 = opts?.imageBase64?.trim();
  if (!base64) {
    console.warn("[GoogleLens] No imageBase64 — skipping Lens scraper");
    return null;
  }

  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[GoogleLens] APIFY_API_KEY missing — skipping");
    return null;
  }

  try {
    throwIfAborted(signal, "googleLens");
    const mime = opts?.imageMimeType?.trim() || "image/jpeg";
    const imageUrl = await uploadImageToApifyStore(base64, mime);
    console.log(`[GoogleLens] Uploaded image for actor (${mime})`);

    const input = {
      searchTypes: ["products"],
      imageUrls: [{ url: imageUrl }],
      language: "en",
      translateLanguage: "en",
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
      },
    };

    console.log(
      `[GoogleLens] Actor: ${ACTOR_ID} mode=products input:`,
      JSON.stringify({ searchTypes: input.searchTypes, imageUrl: "[apify-kv]" })
    );

    const run = await raceWithAbortSignal(
      client.actor(ACTOR_ID).call(input, { waitSecs: RUN_TIMEOUT_SECS }),
      signal
    );

    console.log(`[GoogleLens] Run ${run.status} id=${run.id}`);

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 20 });

    console.log(`[GoogleLens] Dataset items: ${items?.length ?? 0}`);
    if (items?.length) {
      console.log(
        "[GoogleLens] Sample item keys:",
        Object.keys(items[0] as object).join(", ")
      );
    }

    const listings = collectProductListings(items ?? []);
    if (listings.length === 0) {
      console.warn("[GoogleLens] No product listings parsed from dataset");
      return null;
    }

    console.log(
      `[GoogleLens] Parsed ${listings.length} product row(s); first: "${listings[0].title}"`
    );

    const matchCtx: VisionMatchContext = context ?? {
      visionTitle: _query,
      visionBrand: "",
    };

    const aggregated = aggregateListings(listings, matchCtx.visionTitle, matchCtx);
    if (!aggregated) return null;

    return {
      ...aggregated,
      scraperSource: "googleLens",
      link: aggregated.url ?? listings[0]?.url ?? "",
      url: aggregated.url ?? listings[0]?.url ?? "",
      lensImageUrl: imageUrl,
    };
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.error("[GoogleLens] Error:", err);
    return null;
  }
}
