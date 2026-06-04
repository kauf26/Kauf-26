// server/scrapers/googleShopping.ts
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import {
  isAbortError,
  type ScraperRunOptions,
  throwIfAborted,
} from "./scraperOptions";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

type GoogleSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
  pagemap?: {
    offer?: Array<{ price?: string }>;
    product?: Array<{ name?: string; brand?: string; price?: string }>;
    metatags?: Array<Record<string, string>>;
  };
};

function extractPrice(text: string): number {
  const m = text.match(/\$[\d,]+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:USD|usd)/i);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function extractBrand(title: string, pagemapBrand?: string): string {
  if (pagemapBrand?.trim()) return pagemapBrand.trim();
  const m = title.match(/^([A-Z][a-zA-Z0-9&'.-]+)/);
  return m?.[1]?.trim() ?? "";
}

function normalizeGoogleItem(item: GoogleSearchItem): RawListing | null {
  const title = String(item.title ?? "").trim();
  if (!title) return null;

  const productMeta = item.pagemap?.product?.[0];
  const offerMeta = item.pagemap?.offer?.[0];
  const snippet = String(item.snippet ?? "").trim();
  const priceStr = offerMeta?.price ?? productMeta?.price ?? snippet;
  const price = extractPrice(String(priceStr));

  return {
    title,
    brand: extractBrand(title, productMeta?.brand),
    description: snippet,
    price: price > 0 ? price : undefined,
    category: "",
    condition: "",
  };
}

/**
 * Google Custom Search JSON API.
 * Configure GOOGLE_CX as a Programmable Search Engine tuned for product/shopping results.
 */
export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> => {
  const signal = opts?.signal;
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CX?.trim();

  if (!apiKey || !cx) {
    console.warn("[Google] GOOGLE_API_KEY or GOOGLE_CX missing — skipping");
    return null;
  }

  try {
    const url = new URL(GOOGLE_SEARCH_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(SCRAPE_LISTING_LIMIT, 10)));
    url.searchParams.set("searchType", "shopping");

    console.log(`[Google] Custom Search query: ${query}`);
    throwIfAborted(signal, "google");
    let res = await fetch(url.toString(), { signal });
    if (!res.ok && res.status === 400) {
      console.warn(
        "[Google] searchType=shopping rejected — retrying without searchType"
      );
      url.searchParams.delete("searchType");
      throwIfAborted(signal, "google");
      res = await fetch(url.toString(), { signal });
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Google] HTTP ${res.status}:`, body.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { items?: GoogleSearchItem[] };
    const items = data.items ?? [];
    console.log(`[Google] Raw result count: ${items.length}`);

    const listings = items
      .map(normalizeGoogleItem)
      .filter((row): row is RawListing => row != null);

    if (listings.length > 0) {
      console.log(
        `[Google] First item — title: "${listings[0].title ?? ""}" brand: "${listings[0].brand ?? ""}" price: ${listings[0].price ?? "n/a"}`
      );
    }

    if (listings.length === 0) {
      console.warn("[Google] No parseable listings");
      return null;
    }

    const aggregated = aggregateListings(listings, query, context);
    if (!aggregated) return null;

    return {
      ...aggregated,
      scraperSource: "google",
      link: items[0]?.link ?? "",
    };
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.error("[Google] Error:", err);
    return null;
  }
};
