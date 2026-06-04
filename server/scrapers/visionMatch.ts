/**
 * Vision ↔ listing matching with no product-category or brand allowlists.
 * Uses only what vision returns (title, brand) and scraper row content.
 */

import type { RawListing, VisionMatchContext } from "./listingUtils";

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
  /\/(collections?|categories?|catalog|shop)\/|index\.htm(l)?(\?|$)|\/search\?/i;

const PRODUCT_URL_RE =
  /\/(item|listing|product|p|dp|itm|offer|sku|goods)\/|\/\d{6,}|[?&](item|product|sku)=/i;

/** Minimum listingExactRank to treat a row as exact (tunable via env) */
export const EXACT_MATCH_MIN_RANK = Number(
  process.env.EXACT_MATCH_MIN_RANK ?? 42
);

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

/** Category / hub pages — not a specific product row */
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

/** 0–100 similarity of listing to vision (higher = more exact) */
export function listingExactRank(
  listing: RawListing,
  ctx: VisionMatchContext
): number {
  if (isCategoryListing(listing, ctx)) return 0;

  const blob = `${listing.title ?? ""} ${listing.description ?? ""}`;
  const visionBrand = normalizeText(ctx.visionBrand ?? "");
  let rank = 0;

  const overlap = tokenOverlapRatio(
    ctx.visionTitle,
    ctx.visionBrand ?? "",
    blob
  );
  rank += Math.round(overlap * 55);

  if (visionBrand && normalizeText(blob).includes(visionBrand)) {
    rank += 20;
  }

  for (const ref of extractReferenceNumbers(ctx.visionTitle)) {
    if (normalizeText(blob).includes(ref)) rank += 45;
  }

  const url = String(listing.url ?? "");
  if (url && PRODUCT_URL_RE.test(url)) rank += 8;

  const priceStr = String(listing.price ?? "");
  if (priceStr && parseFloat(priceStr.replace(/[^0-9.]/g, "")) > 0) {
    rank += 5;
  }

  return Math.min(100, rank);
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
