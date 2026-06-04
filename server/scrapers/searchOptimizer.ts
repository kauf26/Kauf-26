import {
  extractReferenceNumbers,
  normalizeText,
  significantTokens,
} from "./visionMatch";

/** Model / SKU tokens: letters+digits with optional dot/hyphen segment */
const MODEL_TOKEN_RE = /\b([A-Z0-9]{2,}[.-]?[A-Z0-9]{2,})\b/gi;

export function extractModelNumbers(term: string): string[] {
  const found = new Set<string>();

  for (const ref of extractReferenceNumbers(term)) {
    found.add(ref.toLowerCase());
    const base = ref.replace(/\.[0-9a-z]+$/i, "");
    if (base.length >= 3) found.add(base.toLowerCase());
  }

  for (const m of term.matchAll(MODEL_TOKEN_RE)) {
    const r = (m[1] ?? "").replace(/\s+/g, "").toLowerCase();
    if (r.length >= 4) found.add(r);
  }

  return [...found];
}

function dedupe(queries: string[]): string[] {
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

function titleWithoutStopWords(title: string, brand: string): string {
  const tokens = significantTokens(title, brand);
  return tokens.length > 0 ? tokens.join(" ") : title.trim();
}

/**
 * Up to 3 generic marketplace queries from vision (no brand/category allowlists).
 * 1. Full vision title
 * 2. Model number alone (if found)
 * 3. Brand + model number (if both exist)
 * If no model number: full title + stop-word-stripped title.
 */
export function optimizeSearchTerm(
  visionTitle: string,
  visionBrand?: string
): string[] {
  const title = visionTitle.trim().replace(/\s+/g, " ");
  const brand = visionBrand?.trim() ?? "";
  if (!title) return [];

  const modelNumbers = extractModelNumbers(title);
  const queries: string[] = [];

  queries.push(title);

  if (modelNumbers.length > 0) {
    const model = modelNumbers[0];
    queries.push(model);
    if (brand) {
      const brandNorm = normalizeText(brand);
      if (!normalizeText(model).includes(brandNorm)) {
        queries.push(`${brand} ${model}`.trim());
      }
    }
  } else {
    const stripped = titleWithoutStopWords(title, brand);
    if (stripped.toLowerCase() !== title.toLowerCase()) {
      queries.push(stripped);
    }
  }

  return dedupe(queries).slice(0, 3);
}
