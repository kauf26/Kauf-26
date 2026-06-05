/**
 * Uses apify/google-search-scraper — query expansion until exact match or chain exhausted.
 */
import { ApifyClient } from "apify-client";
import {
  aggregateListings,
  logListingRankDiagnostics,
  SCRAPE_LISTING_LIMIT,
  type RawListing,
  type VisionMatchContext,
} from "./listingUtils";
import { buildQueryExpansionChain } from "./queryExpansion";
import { bestPriceFromText } from "./priceFromText";
import {
  isAbortError,
  type ScraperRunOptions,
  raceWithAbortSignal,
  throwIfAborted,
} from "./scraperOptions";
import {
  applyValidationToProduct,
  buildMatchTargetFromContext,
  validateMatch,
} from "./validateMatch";
import { normalizeText, significantTokens } from "./visionMatch";
import { detectLuxuryProfile, isPriceSaneForLuxury } from "./luxuryPricing";
import { evaluateOrganicResult } from "./productPageFilter";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_ACTOR = "apify/google-search-scraper";
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? 35);

const PRODUCT_URL_RE =
  /\/(item|listing|product|p|dp|itm|offer|sku|goods)\/|\/\d{6,}|[?&](item|product|sku)=/i;

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

type OrganicResult = {
  title?: string;
  url?: string;
  description?: string;
  displayedUrl?: string;
};

/** Trailing marketplace noise (em-dash / pipe). Do NOT include ASCII hyphen — breaks "Pre-Owned". */
const TITLE_TRAILING_NOISE_RE =
  /\s+[»|–—]\s*.+$|\s+for sale.*$|\s+check prices.*$|\s+price breakdown.*$/i;

const TITLE_PREFIX_NOISE_RE =
  /\b(pre[- ]?owned|used|like new|new|vintage|authentic|certified|genuine|official)\b/gi;

const ICONIC_MODEL_RE =
  /\b(submariner(?:\s+date)?|daytona|datejust|speedmaster|seamaster|royal\s+oak|nautilus|aquaracer)\b/i;

const MODEL_ATTR_NOISE_RE =
  /\b(stainless|steel|silver|black|white|gold|dial|bezel|oyster|ceramic|sapphire|automatic|quartz|and|with)\b/gi;

function refineWatchModel(model: string): string {
  let m = String(model ?? "")
    .replace(MODEL_ATTR_NOISE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  const iconic = m.match(ICONIC_MODEL_RE);
  if (iconic?.[0]) return iconic[0];
  return m;
}

const GENERIC_TITLE_LEADERS = new Set([
  "hats",
  "hat",
  "caps",
  "cap",
  "shop",
  "store",
  "pre",
  "owned",
  "the",
  "watches",
  "watch",
]);

/** Parse marketplace title → brand + model (e.g. "Pre-Owned Rolex Submariner" → Rolex / Submariner) */
export function extractBrandModelFromTitle(
  title: string,
  hintBrand?: string
): {
  brand: string;
  model: string;
} {
  let t = String(title ?? "")
    .replace(TITLE_TRAILING_NOISE_RE, "")
    .replace(TITLE_PREFIX_NOISE_RE, "")
    .replace(/\bwatches?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const hint = String(hintBrand ?? "").trim();
  if (hint && t.toLowerCase().includes(hint.toLowerCase())) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const model = refineWatchModel(
      t
        .replace(new RegExp(escaped, "gi"), "")
        .replace(/\bhats?\b|\bcaps?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    return { brand: hint, model };
  }

  const multiWordBrand = t.match(
    /^(The\s+[A-Z][\w']+(?:\s+[A-Z][\w']+)?|Tag\s+Heuer|Patek\s+Philippe|Audemars\s+Piguet|Louis\s+Vuitton)\b/i
  );
  if (multiWordBrand) {
    const brand = multiWordBrand[1];
    const model = t.slice(brand.length).trim();
    return { brand, model };
  }

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { brand: "", model: "" };

  let start = 0;
  while (
    start < parts.length - 1 &&
    GENERIC_TITLE_LEADERS.has(parts[start].toLowerCase().replace(/-/g, ""))
  ) {
    start++;
  }

  const brand = parts[start]?.replace(/['']s$/i, "") ?? "";
  let model = parts.slice(start + 1).join(" ").trim();

  if (GENERIC_TITLE_LEADERS.has(brand.toLowerCase())) {
    return { brand: hint || "", model: parts.join(" ").trim() };
  }

  const ref = t.match(/\b([A-Z]{1,4}[-]?\d{4,}[A-Z0-9-]*)\b/);
  if (ref && !model.toUpperCase().includes(ref[1].toUpperCase())) {
    model = model ? `${model} ${ref[1]}` : ref[1];
  }
  return { brand, model: refineWatchModel(model) };
}

function deriveCanonicalBrandModel(listings: RawListing[]): {
  brand: string;
  model: string;
} {
  const brandCounts = new Map<string, number>();
  let firstModel = "";

  for (const row of listings.slice(0, 6)) {
    const { brand, model } = extractBrandModelFromTitle(String(row.title ?? ""));
    if (brand) {
      const key = brand.toLowerCase();
      brandCounts.set(key, (brandCounts.get(key) ?? 0) + 1);
    }
    if (!firstModel && model) firstModel = model;
  }

  let topBrand = "";
  let topCount = 0;
  for (const [key, count] of brandCounts) {
    if (count > topCount) {
      topCount = count;
      const sample = listings.find((l) =>
        extractBrandModelFromTitle(String(l.title ?? "")).brand
          .toLowerCase()
          .startsWith(key)
      );
      topBrand = sample
        ? extractBrandModelFromTitle(String(sample.title ?? "")).brand
        : key;
    }
  }

  if (!topBrand && listings[0]?.title) {
    const parsed = extractBrandModelFromTitle(String(listings[0].title));
    topBrand = parsed.brand;
    firstModel = parsed.model;
  }

  return { brand: topBrand, model: firstModel };
}

function extractSpecLines(blob: string): string[] {
  const specs: string[] = [];
  if (/automatic|self[- ]?winding/i.test(blob)) {
    specs.push("Movement: automatic");
  }
  if (/quartz/i.test(blob)) specs.push("Movement: quartz");
  if (/stainless steel/i.test(blob)) specs.push("Case material: stainless steel");
  if (/titanium/i.test(blob)) specs.push("Case material: titanium");
  if (/ceramic/i.test(blob)) specs.push("Case material: ceramic");
  if (/chronograph/i.test(blob)) specs.push("Complications: chronograph");
  if (/gmt/i.test(blob)) specs.push("Complications: GMT");
  if (/\d+\s*mm/i.test(blob)) {
    const mm = blob.match(/(\d{2})\s*mm/i);
    if (mm) specs.push(`Case size: ${mm[1]} mm`);
  }
  return specs;
}

/** Up to 30 lines: description, pricing band, specs, comparable listings */
export function buildLongDescription(
  rep: RawListing,
  listings: RawListing[],
  meta: {
    brand?: string;
    model?: string;
    medianPrice?: number;
    priceMin?: number;
    priceMax?: number;
    priceReliable?: boolean;
  }
): string {
  const lines: string[] = [];
  const headline = [meta.brand, meta.model].filter(Boolean).join(" ").trim();
  if (headline) lines.push(headline);
  if (rep.title) lines.push(String(rep.title));

  const desc = String(rep.description ?? "").trim();
  if (desc) {
    lines.push("");
    lines.push(desc);
  }

  if (meta.medianPrice && meta.medianPrice > 0) {
    lines.push("");
    lines.push("Market pricing (USD):");
    if (
      meta.priceMin &&
      meta.priceMax &&
      meta.priceMin > 0 &&
      meta.priceMax > meta.priceMin
    ) {
      lines.push(`  Range: $${meta.priceMin} – $${meta.priceMax}`);
    }
    lines.push(
      `  Median: $${meta.medianPrice}${
        meta.priceReliable ? "" : " (limited sample size)"
      }`
    );
  }

  const blob = listings
    .map((l) => `${l.title ?? ""} ${l.description ?? ""}`)
    .join(" ");
  const specs = extractSpecLines(blob);
  if (specs.length > 0) {
    lines.push("");
    lines.push("Key specs:");
    for (const s of specs) lines.push(`  ${s}`);
  }

  const comps = listings
    .filter((l) => l.title && l.title !== rep.title)
    .slice(0, 4);
  if (comps.length > 0) {
    lines.push("");
    lines.push("Comparable marketplace listings:");
    for (const c of comps) {
      const p =
        c.price != null && Number(c.price) > 0 ? ` — $${c.price}` : "";
      lines.push(`  • ${c.title}${p}`);
    }
  }

  return lines.slice(0, 30).join("\n");
}

function titleMatchesQueryKeywords(
  title: string,
  searchQuery: string,
  visionBrand?: string
): boolean {
  const tokens = significantTokens(searchQuery, visionBrand);
  if (tokens.length === 0) return true;
  const normTitle = normalizeText(title);
  return tokens.every((t) => normTitle.includes(t));
}

function organicToListing(
  row: OrganicResult,
  searchQuery: string,
  visionBrand?: string
): RawListing | null {
  const title = String(row.title ?? "").trim();
  if (!title) {
    console.log(
      `[DEBUG][GoogleSearchApify] organic REJECT missing_title url=${String(row.url ?? "").slice(0, 80)}`
    );
    return null;
  }

  const url = String(row.url ?? "").trim();
  const blob = `${title} ${row.description ?? ""}`;
  let price = bestPriceFromText(blob, 0);

  const luxuryProfile = detectLuxuryProfile(
    visionBrand,
    searchQuery,
    title
  );
  if (
    price > 0 &&
    luxuryProfile?.isLuxuryWatch &&
    !isPriceSaneForLuxury(price, luxuryProfile)
  ) {
    console.log(
      `[DEBUG][GoogleSearchApify] organic REJECT luxury_price_too_low price=${price} title="${title.slice(0, 80)}"`
    );
    price = 0;
  }

  const pageVerdict = evaluateOrganicResult({
    title,
    url,
    description: String(row.description ?? ""),
    price,
  });

  if (!pageVerdict.accept) {
    console.log(
      `[DEBUG][GoogleSearchApify] organic REJECT ${pageVerdict.reason} title="${title.slice(0, 80)}" url=${url.slice(0, 80)}`
    );
    return null;
  }

  const keywordMatch = titleMatchesQueryKeywords(title, searchQuery, visionBrand);
  const looksLikeProduct = PRODUCT_URL_RE.test(url);

  if (!keywordMatch && price <= 0 && !looksLikeProduct && !pageVerdict.isMarketplace) {
    console.log(
      `[DEBUG][GoogleSearchApify] organic REJECT weak_keyword_match title="${title.slice(0, 80)}" url=${url.slice(0, 80)}`
    );
    return null;
  }

  console.log(
    `[DEBUG][GoogleSearchApify] organic ACCEPT ${pageVerdict.reason} title="${title.slice(0, 80)}" ` +
      `keywordMatch=${keywordMatch} price=${price} marketplace=${pageVerdict.isMarketplace}`
  );

  const { brand: parsedBrand, model: parsedModel } =
    extractBrandModelFromTitle(title, visionBrand);

  return {
    title,
    brand: parsedBrand || visionBrand?.trim() || "",
    model: parsedModel,
    description: String(row.description ?? "").trim(),
    price: price > 0 ? price : undefined,
    category: "",
    condition: /pre-?owned|used|vintage|refurb/i.test(blob) ? "Used" : "",
    url,
  };
}

async function runGoogleSearch(
  searchQuery: string,
  visionTitle: string,
  context?: VisionMatchContext,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  throwIfAborted(signal, "googleSearchApify");
  const actorId =
    process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const q = searchQuery.includes("price") ? searchQuery : `${searchQuery} price`;

  const input = {
    queries: q,
    maxPagesPerQuery: 1,
    resultsPerPage: Math.min(SCRAPE_LISTING_LIMIT + 4, 10),
    languageCode: "en",
    countryCode: "us",
  };

  console.log(`[GoogleSearchApify] Actor: ${actorId} query: "${q}"`);

  const run = await raceWithAbortSignal(
    client.actor(actorId).call(input, { waitSecs: RUN_TIMEOUT_SECS }),
    signal
  );

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 5 });

  const organic: OrganicResult[] = [];
  for (const page of items ?? []) {
    const rows = (page as { organicResults?: OrganicResult[] }).organicResults;
    if (Array.isArray(rows)) organic.push(...rows);
  }

  console.log(
    `[GoogleSearchApify] Run ${run.status}; organic: ${organic.length} for "${q}"`
  );

  for (let i = 0; i < Math.min(3, organic.length); i++) {
    const row = organic[i];
    console.log(
      `[GoogleSearchApify] Apify organic[${i}]: title="${String(row.title ?? "").slice(0, 100)}" url=${String(row.url ?? "").slice(0, 120)}`
    );
  }

  const visionBrand = context?.visionBrand?.trim();
  const listings = organic
    .map((r) => organicToListing(r, q, visionBrand))
    .filter((r): r is RawListing => r != null)
    .slice(0, SCRAPE_LISTING_LIMIT + 2);

  console.log(
    `[GoogleSearchApify] Query "${q}" → organic=${organic.length} listings=${listings.length}`
  );

  if (listings.length === 0) return null;

  const matchCtx: VisionMatchContext = context ?? {
    visionTitle,
    visionBrand: visionBrand ?? "",
  };

  logListingRankDiagnostics(listings, matchCtx, {
    label: "GoogleSearchApify",
    searchQuery: q,
    limit: 5,
  });

  let aggregated = aggregateListings(listings, visionTitle, matchCtx);
  if (!aggregated) return null;

  const canonical = deriveCanonicalBrandModel(listings);
  if (canonical.brand) aggregated.brand = canonical.brand;
  if (canonical.model) aggregated.model = canonical.model;

  const repTitle = String(aggregated.title ?? "");
  const repListing =
    listings.find((l) => l.title === repTitle) ?? listings[0];

  aggregated.longDescription = buildLongDescription(repListing, listings, {
    brand: String(aggregated.brand ?? canonical.brand),
    model: String(aggregated.model ?? canonical.model),
    medianPrice: Number(aggregated.medianPrice ?? aggregated.price ?? 0),
    priceMin: Number(aggregated.priceMin ?? 0),
    priceMax: Number(aggregated.priceMax ?? 0),
    priceReliable: aggregated.priceReliable === true,
  });

  const target = buildMatchTargetFromContext(matchCtx);
  const validation = validateMatch(
    {
      title: String(aggregated.title ?? ""),
      brand: String(aggregated.brand ?? ""),
      description: String(aggregated.description ?? ""),
      url: String(aggregated.url ?? aggregated.link ?? ""),
    },
    target
  );
  aggregated = applyValidationToProduct(aggregated, validation);
  if (validation.accepted) {
    console.log(
      `[GoogleSearchApify] validateMatch ${validation.confidence}: ${validation.reason}`
    );
  }

  const priced = listings.filter(
    (l) => l.price != null && Number(l.price) > 0
  ).length;
  if (priced < 2) {
    aggregated.priceReliable = false;
  }
  if (!aggregated.price || aggregated.price === 0) {
    const fallback = bestPriceFromText(
      listings.map((l) => `${l.title} ${l.description}`).join(" "),
      0
    );
    if (fallback > 0) {
      aggregated.price = fallback;
      aggregated.medianPrice = fallback;
      aggregated.ebayAvg = fallback;
      aggregated.allegroAvg = fallback;
    }
  }

  const bestUrl =
    String(aggregated.url ?? aggregated.link ?? "") ||
    listings.find((l) => l.url)?.url ||
    organic[0]?.url ||
    "";

  return {
    ...aggregated,
    scraperSource: "apify",
    link: bestUrl,
    url: bestUrl,
    searchQueryUsed: q,
  };
}

export async function scrapeViaGoogleSearch(
  _query: string,
  context?: VisionMatchContext,
  opts?: ScraperRunOptions
): Promise<Record<string, unknown> | null> {
  const signal = opts?.signal;
  if (!process.env.APIFY_API_KEY?.trim()) {
    console.warn("[GoogleSearchApify] APIFY_API_KEY missing — skipping");
    return null;
  }

  const visionTitle = context?.visionTitle?.trim() || _query.trim();
  const visionBrand = context?.visionBrand?.trim();
  const queryChain =
    opts?.queryChain ??
    buildQueryExpansionChain(visionTitle, visionBrand);

  console.log(
    `[GoogleSearchApify] Query expansion chain (${queryChain.length}):`,
    queryChain.map((q, i) => `${i + 1}. "${q}"`).join(" | ")
  );

  let lastResult: Record<string, unknown> | null = null;

  try {
    for (let i = 0; i < queryChain.length; i++) {
      throwIfAborted(signal, "googleSearchApify");
      const q = queryChain[i];
      console.log(
        `[GoogleSearchApify] Attempt ${i + 1}/${queryChain.length}: "${q}"`
      );
      const result = await runGoogleSearch(q, visionTitle, context, signal);
      if (!result) continue;

      lastResult = result;

      if (result.isExactMatch === true) {
        console.log(
          `[GoogleSearchApify] Exact match on attempt ${i + 1} — "${result.title}"`
        );
        return result;
      }
    }

    if (lastResult) {
      lastResult.isExactMatch = false;
      lastResult.matchType = "similar";
      console.log(
        `[GoogleSearchApify] No exact after ${queryChain.length} queries — returning best similar`
      );
    }

    return lastResult;
  } catch (err) {
    if (isAbortError(err)) {
      console.log(
        "[GoogleSearchApify] Aborted — parallel race exact match won elsewhere"
      );
      throw err;
    }
    console.error("[GoogleSearchApify] Error:", err);
    return null;
  }
}
