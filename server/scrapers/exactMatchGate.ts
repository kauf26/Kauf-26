/**
 * Scraper may override vision title/brand only when all gates pass.
 */

import { hasProductListingStructure } from "./productPageFilter";
import { normalizeText } from "./visionMatch";

const MIN_PRICE = 5;
const MAX_PRICE = 500;
const MIN_TOKEN_MATCH = 0.9;

const TITLE_STOP = new Set([
  "with", "from", "that", "this", "your", "for", "the", "and", "new", "used",
]);

function significantTokens(title: string): string[] {
  return normalizeText(title)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TITLE_STOP.has(w));
}

/** Jaccard overlap on significant tokens (0–1) */
export function visionTokenMatchRatio(
  visionTitle: string,
  scraperTitle: string
): number {
  const a = new Set(significantTokens(visionTitle));
  const b = new Set(significantTokens(scraperTitle));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) if (b.has(w)) overlap++;
  const union = a.size + b.size - overlap;
  return union > 0 ? overlap / union : 0;
}

export function priceInResaleBand(price: unknown): boolean {
  const n = parseFloat(String(price ?? 0)) || 0;
  return n >= MIN_PRICE && n <= MAX_PRICE;
}

export type ScraperOverrideInput = {
  visionTitle: string;
  scraperTitle: string;
  price?: unknown;
  description?: string;
  url?: string;
};

export function canScraperOverrideVision(input: ScraperOverrideInput): {
  allowed: boolean;
  reasons: string[];
  tokenMatch: number;
} {
  const reasons: string[] = [];
  const tokenMatch = visionTokenMatchRatio(
    input.visionTitle,
    input.scraperTitle
  );

  if (tokenMatch < MIN_TOKEN_MATCH) {
    reasons.push(`token_match=${tokenMatch.toFixed(2)}<${MIN_TOKEN_MATCH}`);
  }
  if (!priceInResaleBand(input.price)) {
    reasons.push(`price_out_of_band_${input.price}`);
  }
  if (
    !hasProductListingStructure(
      input.scraperTitle,
      String(input.description ?? ""),
      String(input.url ?? "")
    )
  ) {
    reasons.push("no_product_listing_structure");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    tokenMatch,
  };
}
