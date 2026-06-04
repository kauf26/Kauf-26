import {
  buildBroadMarketplaceQuery,
  buildExactMarketplaceQuery,
} from "./marketplaceQuery";
import { optimizeSearchTerm } from "./searchOptimizer";
import { extractReferenceNumbers, significantTokens } from "./visionMatch";

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const t = q.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Ordered search queries: strict vision title first, then progressive relaxations.
 * No product-specific allowlists — derived only from vision title/brand.
 */
export function buildQueryExpansionChain(
  visionTitle: string,
  visionBrand?: string
): string[] {
  const title = visionTitle.trim();
  const brand = visionBrand?.trim() ?? "";
  const chain: string[] = [];

  for (const q of optimizeSearchTerm(title, brand)) {
    chain.push(q);
  }

  chain.push(buildExactMarketplaceQuery(title, brand));

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 2) {
    chain.push(words.slice(0, -1).join(" "));
  }

  const tokens = significantTokens(title, brand);
  if (brand && tokens.length > 0) {
    chain.push(`${brand} ${tokens[0]}`);
    if (tokens.length > 1) {
      chain.push(`${brand} ${tokens.slice(0, 2).join(" ")}`);
    }
  }

  for (const ref of extractReferenceNumbers(title)) {
    const base = ref.replace(/\.[0-9a-z]+$/i, "");
    if (base.length >= 4 && base !== ref) {
      if (brand) chain.push(`${brand} ${base}`);
      chain.push(base);
    }
    if (brand) chain.push(`${brand} ${ref}`);
  }

  const depunct = title
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (depunct && depunct.toLowerCase() !== title.toLowerCase()) {
    chain.push(depunct);
  }

  const hyphenated = title.replace(/\s+/g, "-");
  if (hyphenated.toLowerCase() !== title.toLowerCase()) {
    chain.push(hyphenated);
  }

  chain.push(buildBroadMarketplaceQuery(title, brand));

  return dedupeQueries(chain);
}
