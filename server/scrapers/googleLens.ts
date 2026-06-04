/**
 * Google Lens visual exact-match scraper (Apify prodiger/google-lens-scraper).
 * Stage-1: product-search + exact-match on captured image (+ optional vision text query).
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { buildMatchContext, isProductPageUrl } from "./visionMatch";
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
/** Apify actor wait — keep ≤4s for Stage 1 budget */
const RUN_TIMEOUT_SECS = Number(process.env.GOOGLE_LENS_TIMEOUT_SECS ?? 4);

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function uploadImageToApifyStore(
  base64: string,
  mimeType: string
): Promise<string> {
  const token = process.env.APIFY_API_KEY?.trim();
  if (!token) throw new Error("APIFY_API_KEY missing");

  const buffer = Buffer.from(
    base64.replace(/^data:[^;]+;base64,/, ""),
    "base64"
  );
  const store = await client.keyValueStores().getOrCreate(
    `kauf26-lens-${Date.now()}`
  );
  const key = `product-image.${extensionForMime(mimeType)}`;

  await client.keyValueStore(store.id).setRecord({
    key,
    value: buffer as unknown as Parameters<
      ReturnType<ApifyClient["keyValueStore"]>["setRecord"]
    >[0]["value"],
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

  const url = String(
    raw.url ?? raw.link ?? raw.productUrl ?? raw.sourceUrl ?? ""
  ).trim();

  return {
    title,
    brand: String(raw.brand ?? raw.manufacturer ?? "").trim(),
    description: String(raw.description ?? raw.snippet ?? "").trim(),
    price,
    url,
    category: String(raw.category ?? "").trim(),
    condition: String(raw.condition ?? "").trim(),
  };
}

function collectLensListings(items: unknown[]): RawListing[] {
  const listings: Array<RawListing & { _exactTab?: boolean }> = [];

  const visit = (node: unknown, parentMode = "") => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const mode = String(
      o.searchType ?? o.mode ?? o.searchMode ?? o.type ?? parentMode ?? ""
    ).toLowerCase();
    const exactTab = mode.includes("exact");

    const nested = [
      o.products,
      o.productResults,
      o.results,
      o.items,
      o.matches,
      o.visualMatches,
      o.exactMatches,
    ];
    let expanded = false;
    for (const block of nested) {
      if (Array.isArray(block) && block.length > 0) {
        expanded = true;
        for (const row of block) {
          if (row && typeof row === "object") {
            const listing = normalizeLensRow(row as Record<string, unknown>);
            if (listing) listings.push({ ...listing, _exactTab: exactTab });
          }
        }
      }
    }

    if (!expanded) {
      const listing = normalizeLensRow(o);
      if (listing) listings.push({ ...listing, _exactTab: exactTab });
    }
  };

  for (const item of items) visit(item);

  listings.sort((a, b) => {
    const aUrl = isProductPageUrl(String(a.url ?? "")) ? 2 : 0;
    const bUrl = isProductPageUrl(String(b.url ?? "")) ? 2 : 0;
    const aExact = a._exactTab ? 1 : 0;
    const bExact = b._exactTab ? 1 : 0;
    return bUrl + bExact - (aUrl + aExact);
  });

  return listings
    .slice(0, SCRAPE_LISTING_LIMIT + 6)
    .map(({ _exactTab: _, ...row }) => row);
}

/** Stage-1 win: title + product-page URL (no category/brand allowlists) */
export function lensVisualExactProduct(
  product: Record<string, unknown>
): boolean {
  const title = String(product.title ?? "").trim();
  const productUrl = String(
    product.productUrl ?? product.url ?? product.link ?? ""
  ).trim();
  return title.length > 0 && isProductPageUrl(productUrl);
}

export async function scrapeProduct(
  _query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> {
  const signal = opts?.signal;
  const base64 = opts?.imageBase64?.trim();
  if (!base64) {
    console.warn("[GoogleLens] No imageBase64 — skipping");
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

    const visionQuery = _query.trim() || context?.visionTitle?.trim() || "";

    const input: Record<string, unknown> = {
      searchType: "product-search",
      exactMatch: true,
      imageUrls: [{ url: imageUrl }],
      language: "en",
      translateLanguage: "en",
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
      },
      searchTypes: ["products", "exact-match"],
    };
    if (visionQuery) {
      input.searchQuery = visionQuery;
    }

    console.log(
      `[GoogleLens] ${ACTOR_ID} searchType=product-search exactMatch=true query="${visionQuery || "(image only)"}"`
    );

    const run = await raceWithAbortSignal(
      client.actor(ACTOR_ID).call(input, { waitSecs: RUN_TIMEOUT_SECS }),
      signal
    );

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 24 });

    const listings = collectLensListings(items ?? []);
    if (listings.length === 0) {
      console.warn("[GoogleLens] No listings parsed");
      return null;
    }

    const matchCtx = buildMatchContext(
      context?.visionTitle ?? _query,
      context?.visionBrand,
      { ...context, visualSearchLead: true }
    );

    const aggregated = aggregateListings(
      listings,
      matchCtx.visionTitle,
      matchCtx
    );
    if (!aggregated) return null;

    const productUrl = String(
      aggregated.url ?? aggregated.link ?? listings[0]?.url ?? ""
    ).trim();

    const row: Record<string, unknown> = {
      ...aggregated,
      scraperSource: "googleLens",
      link: productUrl,
      url: productUrl,
      productUrl,
      lensImageUrl: imageUrl,
    };

    if (lensVisualExactProduct(row)) {
      row.isExactMatch = true;
      row.matchType = "exact";
    }

    return row;
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.error("[GoogleLens] Error:", err);
    return null;
  }
}
