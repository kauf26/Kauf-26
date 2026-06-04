/**
 * Vision ↔ listing matching with no product-category or brand allowlists.
 */

import type { RawListing, VisionMatchContext } from "./listingUtils";
import { extractModelNumbers } from "./searchOptimizer";

const STOP_WORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "your",
  "for",
  "the",
  "and",
  "new",
  "used",
  "buy",
  "sale",
  "price",
  "online",
  "shop",
]);

const REFERENCE_RE =
  /\b([A-Z]{1,3}[- ]?\d{3,6}[A-Z0-9]{0,6})\b|\bref\.?\s*([A-Z0-9-]+)\b/gi;

const CATEGORY_TITLE_RE =
  /\b(collections?\s+online|shop\s+all|all\s+\w+\s+(online|for\s+sale)|buy\s+the\s+\w+\s+(collections?|online))\b/i;

const CATEGORY_URL_RE =
  /\/(collections?|categories?|catalog|shop)\/|index\.htm(l)?(\?|$)|\/search(\?|$)/i;

/** Product listing pages (ebay /itm/, amazon /dp/, etc.) */
export const PRODUCT_URL_RE =
  /\/(item|listing|product|p|dp|itm|offer|sku|goods)\b|\/\d{6,}|[?&](item|product|sku)=/i;

export const EXACT_MATCH_MIN_RANK = Number(
  process.env.EXACT_MATCH_MIN_RANK ?? 42
);

export type PriceBand = {
  min: number;
  max: number;
  median: number;
};

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

export function significantTokens(
  text: string,
  excludeBrand?: string
): string[] {
  const brand = normalizeText(excludeBrand ?? "");
  return normalizeText(text)
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !STOP_WORDS.has(w) &&
        w !== brand &&
        !brand.includes(w)
    );
}

export function extractReferenceNumbers(text: string): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(REFERENCE_RE)) {
    const r = (m[1] ?? m[2] ?? "").replace(/\s+/g, "").toLowerCase();
    if (r.length >= 4) refs.add(r);
  }
  return [...refs];
}

export function buildMatchContext(
  visionTitle: string,
  visionBrand?: string,
  extras?: Partial<VisionMatchContext>
): VisionMatchContext {
  const modelNumbers =
    extras?.modelNumbers?.length
      ? extras.modelNumbers
      : extractModelNumbers(visionTitle);

  return {
    visionTitle,
    visionBrand: visionBrand?.trim() ?? "",
    modelNumbers,
    priceBand: extras?.priceBand ?? null,
    visualSearchLead: extras?.visualSearchLead ?? false,
  };
}

/** Dynamic acceptable price range from scraped listing prices */
export function computePriceBand(prices: number[]): PriceBand | null {
  const valid = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (valid.length < 2) return null;

  const mid = Math.floor(valid.length / 2);
  const median =
    valid.length % 2 === 0
      ? (valid[mid - 1] + valid[mid]) / 2
      : valid[mid];

  const min = Math.max(1, median * 0.2);
  const max = median * 5;

  return { min, max, median };
}

export function parseListingPriceValue(price: unknown): number {
  const str = String(price ?? "").replace(/[^0-9.]/g, "");
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleContainsModelNumber(
  blob: string,
  modelNumbers: string[]
): boolean {
  const norm = normalizeText(blob);
  return modelNumbers.some((m) => {
    const token = m.toLowerCase();
    return token.length >= 4 && norm.includes(token);
  });
}

export function tokenOverlapRatio(
  visionTitle: string,
  visionBrand: string,
  listingText: string
): number {
  const tokens = significantTokens(visionTitle, visionBrand);
  if (tokens.length === 0) return 0;
  const blob = normalizeText(listingText);
  const hits = tokens.filter((t) => blob.includes(t)).length;
  return hits / tokens.length;
}

export function isCategoryListing(
  listing: Pick<RawListing, "title" | "description" | "url">,
  ctx: VisionMatchContext
): boolean {
  const title = String(listing.title ?? "").trim();
  if (!title) return true;

  const blob = `${title} ${listing.description ?? ""}`;
  const overlap = tokenOverlapRatio(
    ctx.visionTitle,
    ctx.visionBrand ?? "",
    blob
  );
  const visionTokens = significantTokens(
    ctx.visionTitle,
    ctx.visionBrand
  );

  if (CATEGORY_TITLE_RE.test(title)) return true;

  const url = String(listing.url ?? "");
  if (url && CATEGORY_URL_RE.test(url) && !PRODUCT_URL_RE.test(url)) {
    return true;
  }

  if (/\|/.test(title) && overlap < 0.35 && visionTokens.length >= 2) {
    return true;
  }

  if (visionTokens.length >= 3 && overlap < 0.2) return true;

  return false;
}

export function isProductPageUrl(url: string): boolean {
  if (!url) return false;
  return PRODUCT_URL_RE.test(url);
}

function scorePriceAgainstBand(
  price: number,
  band: PriceBand | null | undefined
): number {
  if (!band || price <= 0) return 0;
  if (price >= band.min && price <= band.max) return 18;
  if (price >= band.min * 0.5 && price <= band.max * 1.5) return 8;
  return -30;
}

/** 0–100 — higher = more likely exact match */
export function listingExactRank(
  listing: RawListing,
  ctx: VisionMatchContext
): number {
  if (isCategoryListing(listing, ctx)) return 0;

  const blob = `${listing.title ?? ""} ${listing.description ?? ""}`;
  const normBlob = normalizeText(blob);
  const visionBrand = normalizeText(ctx.visionBrand ?? "");
  const modelNumbers =
    ctx.modelNumbers?.length
      ? ctx.modelNumbers
      : extractModelNumbers(ctx.visionTitle);

  let rank = 0;

  if (ctx.visualSearchLead) rank += 15;

  const overlap = tokenOverlapRatio(
    ctx.visionTitle,
    ctx.visionBrand ?? "",
    blob
  );
  rank += Math.round(overlap * 45);

  if (visionBrand && normBlob.includes(visionBrand)) {
    rank += 18;
  }

  if (titleContainsModelNumber(blob, modelNumbers)) {
    rank += 55;
  } else {
    for (const ref of extractReferenceNumbers(ctx.visionTitle)) {
      if (normBlob.includes(ref)) rank += 35;
    }
  }

  const url = String(listing.url ?? "");
  if (url && isProductPageUrl(url)) {
    rank += 32;
  } else if (url && CATEGORY_URL_RE.test(url)) {
    rank -= 25;
  }

  const price = parseListingPriceValue(listing.price);
  rank += scorePriceAgainstBand(price, ctx.priceBand);
  if (price > 0) rank += 5;

  return Math.min(100, Math.max(0, rank));
}

export function isExactListing(
  listing: RawListing,
  ctx: VisionMatchContext
): boolean {
  return listingExactRank(listing, ctx) >= EXACT_MATCH_MIN_RANK;
}

export function scoreListingMatch(
  listing: RawListing,
  ctx: VisionMatchContext
): "exact" | "similar" {
  return isExactListing(listing, ctx) ? "exact" : "similar";
}

export type ListingRankDiagnostic = {
  index: number;
  title: string;
  brand: string;
  price: string;
  exactRank: number;
  meetsExactThreshold: boolean;
  matchType: "exact" | "similar";
};

export function logListingRankDiagnostics(
  listings: RawListing[],
  ctx: VisionMatchContext,
  opts?: { label?: string; searchQuery?: string; limit?: number }
): ListingRankDiagnostic[] {
  const label = opts?.label ?? "visionMatch";
  const limit = opts?.limit ?? 5;

  console.log(
    `[${label}] EXACT_MATCH_MIN_RANK=${EXACT_MATCH_MIN_RANK} visionTitle="${ctx.visionTitle}" modelNumbers=[${(ctx.modelNumbers ?? []).join(", ")}]`
  );
  if (opts?.searchQuery) {
    console.log(`[${label}] searchQuery="${opts.searchQuery}"`);
  }
  if (ctx.priceBand) {
    console.log(
      `[${label}] priceBand=$${ctx.priceBand.min.toFixed(0)}–$${ctx.priceBand.max.toFixed(0)} (median $${ctx.priceBand.median.toFixed(0)})`
    );
  }

  const diagnostics: ListingRankDiagnostic[] = [];

  listings.slice(0, limit).forEach((row, i) => {
    const rank = listingExactRank(row, ctx);
    const meets = rank >= EXACT_MATCH_MIN_RANK;
    const matchType = meets ? "exact" : "similar";
    const brand = String(row.brand ?? "").trim();
    const price =
      row.price != null && row.price !== ""
        ? String(row.price)
        : "n/a";

    diagnostics.push({
      index: i + 1,
      title: String(row.title ?? "").trim(),
      brand,
      price,
      exactRank: rank,
      meetsExactThreshold: meets,
      matchType,
    });

    console.log(
      `[${label}] row ${i + 1}/${Math.min(limit, listings.length)}: exactRank=${rank} meetsThreshold=${meets} (${matchType}) productUrl=${isProductPageUrl(String(row.url ?? ""))} | title="${row.title ?? ""}" | price=${price}`
    );
  });

  if (listings.length === 0) {
    console.log(`[${label}] no listings to rank`);
  }

  return diagnostics;
}

export function topSimilarListings(
  listings: RawListing[],
  ctx: VisionMatchContext,
  limit = 3
): ListingRankDiagnostic[] {
  return [...listings]
    .map((item, index) => ({
      index: index + 1,
      title: String(item.title ?? "").trim(),
      brand: String(item.brand ?? "").trim(),
      price:
        item.price != null && item.price !== ""
          ? String(item.price)
          : "n/a",
      exactRank: listingExactRank(item, ctx),
      meetsExactThreshold: false,
      matchType: "similar" as const,
    }))
    .filter((r) => r.title.length > 0)
    .sort((a, b) => b.exactRank - a.exactRank)
    .slice(0, limit);
}
