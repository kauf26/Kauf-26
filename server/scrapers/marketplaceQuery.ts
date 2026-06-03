const LUXURY_WATCH_BRANDS = [
  "breitling",
  "rolex",
  "omega",
  "tag heuer",
  "patek",
  "cartier",
  "iwc",
  "panerai",
  "hublot",
  "audemars",
  "tudor",
  "longines",
];

function detectBrand(text: string): string {
  const lower = text.toLowerCase();
  for (const b of LUXURY_WATCH_BRANDS) {
    if (lower.includes(b)) return b.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const m = text.match(/^([A-Z][a-zA-Z&'.-]+)/);
  return m?.[1]?.trim() ?? "";
}

/** Marketplace-friendly query: brand + category, not long vision titles. */
export function buildMarketplaceQuery(
  visionTitle: string,
  visionBrand?: string
): string {
  const title = visionTitle.trim();
  const brand = (visionBrand?.trim() || detectBrand(title)).trim();

  if (brand) {
    const lower = title.toLowerCase();
    if (/\bwatch(es)?\b/.test(lower) || LUXURY_WATCH_BRANDS.some((b) => lower.includes(b))) {
      return `${brand} watch price`;
    }
    return `${brand} ${title.split(/\s+/).slice(0, 3).join(" ")} price`.trim();
  }

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 6) {
    return `${words.slice(0, 5).join(" ")} price`;
  }
  return `${title} price`;
}
