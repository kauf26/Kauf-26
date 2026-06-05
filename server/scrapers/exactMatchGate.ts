/**
 * Scraper may override vision title/brand when token + price gates pass.
 * Luxury watches use wider market bands ($5k–$20k for Rolex, etc.).
 */

import {
  detectLuxuryProfile,
  isPriceInLuxuryMarketBand,
  isPriceSaneForLuxury,
  type LuxuryProfile,
} from "./luxuryPricing";
import { hasProductListingStructure } from "./productPageFilter";
import { normalizeText } from "./visionMatch";

const GENERIC_MIN_PRICE = 5;
const GENERIC_MAX_PRICE = 500;
const MIN_TOKEN_MATCH = 0.9;
const MIN_LUXURY_COVERAGE = 0.75;

const TITLE_STOP = new Set([
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

/** Fraction of vision tokens present in scraper title (good for short vision titles). */
export function visionTokenCoverage(
  visionBlob: string,
  scraperTitle: string
): number {
  const visionTokens = significantTokens(visionBlob);
  if (visionTokens.length === 0) return 0;
  const scraperSet = new Set(significantTokens(scraperTitle));
  const found = visionTokens.filter((t) => scraperSet.has(t)).length;
  return found / visionTokens.length;
}

export function buildVisionMatchBlob(input: {
  visionTitle?: string;
  visionBrand?: string;
  visionMaterial?: string;
  visionColor?: string;
  visionStyle?: string;
}): string {
  return [
    input.visionBrand,
    input.visionTitle,
    input.visionMaterial,
    input.visionColor,
    input.visionStyle,
  ]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function priceInResaleBand(
  price: unknown,
  profile: LuxuryProfile | null
): boolean {
  const n = parseFloat(String(price ?? 0)) || 0;
  if (profile?.isLuxuryWatch) {
    return (
      isPriceSaneForLuxury(n, profile) &&
      isPriceInLuxuryMarketBand(n, profile)
    );
  }
  return n >= GENERIC_MIN_PRICE && n <= GENERIC_MAX_PRICE;
}

export type ScraperOverrideInput = {
  visionTitle: string;
  visionBrand?: string;
  visionMaterial?: string;
  visionColor?: string;
  visionStyle?: string;
  scraperTitle: string;
  scraperBrand?: string;
  price?: unknown;
  description?: string;
  url?: string;
  isExactMatch?: boolean;
};

export function canScraperOverrideVision(input: ScraperOverrideInput): {
  allowed: boolean;
  reasons: string[];
  tokenMatch: number;
  tokenCoverage: number;
  luxuryProfile: LuxuryProfile | null;
} {
  const reasons: string[] = [];

  const luxuryProfile = detectLuxuryProfile(
    input.visionBrand,
    input.visionTitle,
    input.scraperTitle,
    input.scraperBrand
  );

  const visionBlob = buildVisionMatchBlob(input);
  const tokenMatch = Math.max(
    visionTokenMatchRatio(visionBlob, input.scraperTitle),
    visionTokenMatchRatio(input.visionTitle, input.scraperTitle)
  );
  const tokenCoverage = visionTokenCoverage(visionBlob, input.scraperTitle);

  const tokenOk =
    tokenMatch >= MIN_TOKEN_MATCH ||
    (luxuryProfile?.isLuxuryWatch === true &&
      input.isExactMatch === true &&
      tokenCoverage >= MIN_LUXURY_COVERAGE);

  if (!tokenOk) {
    reasons.push(
      `token_match=${tokenMatch.toFixed(2)} coverage=${tokenCoverage.toFixed(2)}`
    );
  }

  if (!priceInResaleBand(input.price, luxuryProfile)) {
    reasons.push(`price_out_of_band_${input.price}`);
  }

  if (luxuryProfile?.isLuxuryWatch && !isPriceSaneForLuxury(input.price, luxuryProfile)) {
    reasons.push(`luxury_price_below_sanity_${input.price}`);
  }

  if (
    !hasProductListingStructure(
      input.scraperTitle,
      String(input.description ?? ""),
      String(input.url ?? "")
    ) &&
    !input.isExactMatch
  ) {
    reasons.push("no_product_listing_structure");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    tokenMatch,
    tokenCoverage,
    luxuryProfile,
  };
}
