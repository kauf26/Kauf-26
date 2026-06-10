import type { VisionConfidence } from "../visionMerge";

/** Iconic models strongly associated with luxury watch brands. */
const LUXURY_MODEL_PATTERNS: RegExp[] = [
  /\bsubmariner\b/i,
  /\bdatejust\b/i,
  /\bdaytona\b/i,
  /\bgmt[\s-]?master\b/i,
  /\boyster\s+perpetual\b/i,
  /\bnautilus\b/i,
  /\broyal\s+oak\b/i,
  /\bspeedmaster\b/i,
  /\bseamaster\b/i,
];

/** Budget / mass-market diver brands that are often confused with luxury lookalikes. */
export const BUDGET_DIVER_BRANDS = new Set([
  "invicta",
  "casio",
  "timex",
  "citizen",
  "orient",
  "seiko 5",
  "megir",
  "pagani",
  "cadisen",
]);

export const LUXURY_WATCH_BRAND_ALIASES = new Set([
  "rolex",
  "omega",
  "patek philippe",
  "audemars piguet",
  "breitling",
  "cartier",
  "iwc",
  "hublot",
  "panerai",
  "tudor",
  "jaeger-lecoultre",
  "tag heuer",
]);

export type VisionBrandAuditInput = {
  title: string;
  brand?: string | null;
  model?: string;
  brandConfidence?: VisionConfidence;
  confidence: VisionConfidence;
  category?: string;
  price?: number | null;
};

export type VisionBrandAuditResult = {
  brand: string;
  brandConfidence: VisionConfidence;
  confidence: VisionConfidence;
  hallucinationFlags: string[];
};

function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase();
}

function titleHasLuxuryModelHint(title: string, model?: string): boolean {
  const blob = `${title} ${model ?? ""}`.toLowerCase();
  return LUXURY_MODEL_PATTERNS.some((re) => re.test(blob));
}

function isBudgetDiverBrand(brand: string): boolean {
  const key = normalizeBrandKey(brand);
  if (BUDGET_DIVER_BRANDS.has(key)) return true;
  for (const b of BUDGET_DIVER_BRANDS) {
    if (key.startsWith(b)) return true;
  }
  return false;
}

function isLuxuryWatchBrand(brand: string): boolean {
  const key = normalizeBrandKey(brand);
  if (LUXURY_WATCH_BRAND_ALIASES.has(key)) return true;
  for (const luxury of LUXURY_WATCH_BRAND_ALIASES) {
    if (key.includes(luxury) || luxury.includes(key)) return true;
  }
  return false;
}

function downgrade(confidence: VisionConfidence): VisionConfidence {
  if (confidence === "high") return "medium";
  return "low";
}

/**
 * Heuristic guard against common vision hallucinations (e.g. Invicta labeled as Rolex
 * or luxury model names paired with budget brands).
 */
export function auditVisionBrandHallucination(
  input: VisionBrandAuditInput
): VisionBrandAuditResult {
  const flags: string[] = [];
  let brand = String(input.brand ?? "").trim();
  let brandConfidence: VisionConfidence =
    input.brandConfidence ?? (brand ? input.confidence : "low");
  let confidence = input.confidence;
  const title = String(input.title ?? "").trim();
  const titleLower = title.toLowerCase();
  const luxuryModelHint = titleHasLuxuryModelHint(title, input.model);

  if (brand && isBudgetDiverBrand(brand) && luxuryModelHint) {
    flags.push("budget_brand_with_luxury_model_name");
    brand = "";
    brandConfidence = "low";
    confidence = downgrade(confidence);
  }

  if (brand && isLuxuryWatchBrand(brand)) {
    const mentionsBudgetInTitle = [...BUDGET_DIVER_BRANDS].some((b) =>
      titleLower.includes(b)
    );
    if (mentionsBudgetInTitle && !titleLower.includes(normalizeBrandKey(brand))) {
      flags.push("luxury_brand_title_mentions_budget_brand");
      brand = "";
      brandConfidence = "low";
      confidence = "low";
    }
  }

  if (brand && isLuxuryWatchBrand(brand)) {
    const price = typeof input.price === "number" ? input.price : 0;
    if (price > 0 && price < 500) {
      flags.push("luxury_brand_with_implausible_low_price");
      brandConfidence = downgrade(brandConfidence);
    }
  }

  if (
    brand &&
    !titleLower.includes(normalizeBrandKey(brand)) &&
    brandConfidence === "high"
  ) {
    flags.push("high_brand_confidence_but_brand_not_in_title");
    brandConfidence = "medium";
  }

  if (!brand) {
    brandConfidence = "low";
  }

  return {
    brand,
    brandConfidence,
    confidence,
    hallucinationFlags: flags,
  };
}
