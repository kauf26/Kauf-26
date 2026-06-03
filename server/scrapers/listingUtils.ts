/** Shared helpers: multi-listing price mean + vision-based exact/similar scoring */

export const SCRAPE_LISTING_LIMIT = 8;

export type RawListing = {
  title?: string;
  brand?: string;
  description?: string;
  price?: unknown;
  category?: string;
  condition?: string;
  material?: string;
  color?: string;
};

export type VisionMatchContext = {
  visionTitle: string;
  visionBrand?: string;
};

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
]);

export function parseListingPrice(price: unknown): number {
  const str = String(price ?? "").replace(/[^0-9.]/g, "");
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function meanPrice(prices: number[]): number {
  const valid = prices.filter((p) => p > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function titleTokens(title: string, minLen = 3): string[] {
  return normalize(title)
    .split(/\s+/)
    .filter((w) => w.length >= minLen && !STOP_WORDS.has(w));
}

/**
 * exact = vision brand (if any) + model tokens align with listing
 * similar = returned by marketplace search but not exact
 */
export function scoreListingMatch(
  listing: RawListing,
  ctx: VisionMatchContext
): "exact" | "similar" {
  const listingTitle = normalize(listing.title ?? "");
  const listingBrand = normalize(listing.brand ?? "");
  const visionBrand = normalize(ctx.visionBrand ?? "");

  if (!listingTitle) return "similar";

  if (visionBrand) {
    const brandHit =
      listingTitle.includes(visionBrand) || listingBrand.includes(visionBrand);
    if (!brandHit) return "similar";

    const modelTokens = titleTokens(ctx.visionTitle).filter(
      (t) => t !== visionBrand
    );
    if (modelTokens.length === 0) return "exact";

    const modelHits = modelTokens.filter(
      (t) => listingTitle.includes(t) || listingBrand.includes(t)
    ).length;
    return modelHits >= Math.ceil(modelTokens.length * 0.5)
      ? "exact"
      : "similar";
  }

  const vt = titleTokens(ctx.visionTitle, 4);
  const lt = new Set(titleTokens(listing.title ?? "", 4));
  if (vt.length === 0) return "similar";
  const overlap = vt.filter((t) => lt.has(t)).length;
  if (overlap / vt.length >= 0.6) return "exact";
  return "similar";
}

function sanitizeBrand(brand: unknown): string {
  const s = String(brand ?? "").trim();
  return !s || s.toUpperCase() === "N/A" ? "" : s;
}

function sanitizeCategory(category: unknown): string {
  const s = String(category ?? "").trim();
  if (!s || /^(general|other)$/i.test(s)) return "";
  return s;
}

/** Collapse N marketplace rows → one product row with mean price + match flags */
export function aggregateListings(
  items: RawListing[],
  query: string,
  ctx?: VisionMatchContext
): Record<string, unknown> | null {
  if (!items.length) return null;

  const matchCtx: VisionMatchContext = ctx ?? {
    visionTitle: query,
    visionBrand: "",
  };

  const scored = items.map((item) => ({
    item,
    score: scoreListingMatch(item, matchCtx),
    price: parseListingPrice(item.price),
  }));

  const exactRows = scored.filter((s) => s.score === "exact");
  const hasExact = exactRows.length > 0;
  const pool = hasExact ? exactRows : scored;
  const avgPrice = meanPrice(pool.map((s) => s.price));
  const rep = (hasExact ? exactRows[0] : scored[0]).item;

  return {
    title: rep.title ?? query,
    brand: sanitizeBrand(rep.brand) || sanitizeBrand(matchCtx.visionBrand),
    description: rep.description ?? "",
    category: sanitizeCategory(rep.category),
    condition: String(rep.condition ?? "").trim(),
    material: String(rep.material ?? "").trim(),
    color: String(rep.color ?? "").trim(),
    price: avgPrice || parseListingPrice(rep.price),
    ebayAvg: avgPrice,
    allegroAvg: avgPrice,
    isExactMatch: hasExact,
    listingCount: items.length,
    samplesPriced: pool.filter((s) => s.price > 0).length,
  };
}
