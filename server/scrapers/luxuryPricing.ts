/**
 * Luxury watch detection, market price bands, and sanity checks.
 */

export type LuxuryProfile = {
  isLuxuryWatch: boolean;
  brand: string;
  /** Min acceptable listing price for override / median */
  minMarketPrice: number;
  /** Max acceptable listing price for override */
  maxMarketPrice: number;
  /** Reject scraped prices below this as erroneous */
  minSanityPrice: number;
  fallbackMin: number;
  fallbackMax: number;
  fallbackSuggested: number;
};

const LUXURY_WATCH_BRANDS: Array<{
  pattern: RegExp;
  brand: string;
  minMarket: number;
  maxMarket: number;
  fallbackSuggested: number;
}> = [
  {
    pattern: /\brolex\b/i,
    brand: "Rolex",
    minMarket: 5_000,
    maxMarket: 20_000,
    fallbackSuggested: 9_500,
  },
  {
    pattern: /\bpatek\s+philippe\b/i,
    brand: "Patek Philippe",
    minMarket: 15_000,
    maxMarket: 200_000,
    fallbackSuggested: 35_000,
  },
  {
    pattern: /\baudemars\s+piguet\b/i,
    brand: "Audemars Piguet",
    minMarket: 10_000,
    maxMarket: 80_000,
    fallbackSuggested: 22_000,
  },
  {
    pattern: /\bomega\b/i,
    brand: "Omega",
    minMarket: 1_500,
    maxMarket: 15_000,
    fallbackSuggested: 4_500,
  },
  {
    pattern: /\btag\s+heuer\b/i,
    brand: "Tag Heuer",
    minMarket: 800,
    maxMarket: 8_000,
    fallbackSuggested: 2_200,
  },
  {
    pattern: /\bbreitling\b/i,
    brand: "Breitling",
    minMarket: 1_500,
    maxMarket: 12_000,
    fallbackSuggested: 4_000,
  },
  {
    pattern: /\biwc\b/i,
    brand: "IWC",
    minMarket: 2_000,
    maxMarket: 15_000,
    fallbackSuggested: 5_500,
  },
  {
    pattern: /\bcartier\b/i,
    brand: "Cartier",
    minMarket: 2_000,
    maxMarket: 25_000,
    fallbackSuggested: 6_500,
  },
  {
    pattern: /\bhublot\b/i,
    brand: "Hublot",
    minMarket: 3_000,
    maxMarket: 30_000,
    fallbackSuggested: 8_500,
  },
  {
    pattern: /\bpanerai\b/i,
    brand: "Panerai",
    minMarket: 2_500,
    maxMarket: 15_000,
    fallbackSuggested: 6_000,
  },
  {
    pattern: /\btudor\b/i,
    brand: "Tudor",
    minMarket: 1_500,
    maxMarket: 8_000,
    fallbackSuggested: 3_200,
  },
  {
    pattern: /\bjaeger[\s-]?lecoultre\b/i,
    brand: "Jaeger-LeCoultre",
    minMarket: 3_000,
    maxMarket: 25_000,
    fallbackSuggested: 7_500,
  },
];

const GENERIC_LUXURY_WATCH_RE =
  /\b(submariner|daytona|datejust|speedmaster|seamaster|royal oak|nautilus|aquaracer)\b/i;

const MIN_LUXURY_SANITY_PRICE = 500;

function normalizeBlob(...parts: (string | undefined | null)[]): string {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Detect luxury watch from vision/scraper text (brand keywords or iconic models). */
export function detectLuxuryProfile(
  ...textParts: (string | undefined | null)[]
): LuxuryProfile | null {
  const blob = normalizeBlob(...textParts).toLowerCase();
  if (!blob) return null;

  for (const entry of LUXURY_WATCH_BRANDS) {
    if (entry.pattern.test(blob)) {
      return {
        isLuxuryWatch: true,
        brand: entry.brand,
        minMarketPrice: entry.minMarket,
        maxMarketPrice: entry.maxMarket,
        minSanityPrice: MIN_LUXURY_SANITY_PRICE,
        fallbackMin: Math.round(entry.fallbackSuggested * 0.55),
        fallbackMax: Math.round(entry.fallbackSuggested * 1.45),
        fallbackSuggested: entry.fallbackSuggested,
      };
    }
  }

  if (GENERIC_LUXURY_WATCH_RE.test(blob) && /\bwatch\b/i.test(blob)) {
    return {
      isLuxuryWatch: true,
      brand: "",
      minMarketPrice: 1_500,
      maxMarketPrice: 25_000,
      minSanityPrice: MIN_LUXURY_SANITY_PRICE,
      fallbackMin: 2_500,
      fallbackMax: 15_000,
      fallbackSuggested: 6_500,
    };
  }

  return null;
}

export function isLuxuryWatchContext(
  ...textParts: (string | undefined | null)[]
): boolean {
  return detectLuxuryProfile(...textParts) !== null;
}

export function isPriceSaneForLuxury(
  price: unknown,
  profile: LuxuryProfile | null
): boolean {
  const n = parseFloat(String(price ?? 0)) || 0;
  if (!profile?.isLuxuryWatch) return n >= 5;
  if (n <= 0) return false;
  return n >= profile.minSanityPrice;
}

export function isPriceInLuxuryMarketBand(
  price: unknown,
  profile: LuxuryProfile | null
): boolean {
  const n = parseFloat(String(price ?? 0)) || 0;
  if (!profile?.isLuxuryWatch) return false;
  return n >= profile.minMarketPrice && n <= profile.maxMarketPrice;
}

/** Drop sub-$500 luxury listings when computing median. */
export function filterLuxuryListingPrices(
  prices: number[],
  profile: LuxuryProfile | null
): number[] {
  const positive = prices.filter((p) => p > 0);
  if (!profile?.isLuxuryWatch) return positive;
  const sane = positive.filter((p) => p >= profile.minSanityPrice);
  return sane.length > 0 ? sane : positive;
}
