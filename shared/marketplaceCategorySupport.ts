/**
 * Category compatibility rules per marketplace.
 * Update allowedKeywords / policyHint here — consumed by web, mobile, and server.
 */

export type MarketplaceCategoryRule = {
  /** Only categories matching at least one keyword are allowed. */
  allowedKeywords: string[];
  /** Short UI hint, e.g. "StockX only accepts footwear". */
  policyHint: string;
};

/** Restricted marketplaces. All others allow any category (MVP). */
export const MARKETPLACE_CATEGORY_RULES: Record<string, MarketplaceCategoryRule> =
  {
    stockx: {
      allowedKeywords: [
        "shoe",
        "shoes",
        "sneaker",
        "sneakers",
        "footwear",
        "boot",
        "boots",
        "trainer",
        "trainers",
        "slide",
        "slides",
        "sandal",
        "sandals",
      ],
      policyHint: "StockX only accepts footwear",
    },
    poshmark: {
      allowedKeywords: [
        "clothing",
        "apparel",
        "fashion",
        "dress",
        "shirt",
        "pants",
        "jeans",
        "jacket",
        "coat",
        "shoe",
        "shoes",
        "footwear",
        "sneaker",
        "accessories",
        "handbag",
        "handbags",
        "bag",
        "purse",
        "jewelry",
        "scarf",
        "hat",
      ],
      policyHint: "Poshmark accepts clothing, shoes, and accessories only",
    },
    wayfair: {
      allowedKeywords: [
        "home",
        "furniture",
        "furnishing",
        "decor",
        "decoration",
        "kitchen",
        "bedding",
        "lighting",
        "outdoor",
        "rug",
        "sofa",
        "couch",
        "table",
        "chair",
        "mattress",
        "lamp",
        "patio",
        "garden",
      ],
      policyHint: "Wayfair accepts home goods and furniture only",
    },
    newegg: {
      allowedKeywords: [
        "electronic",
        "electronics",
        "computer",
        "computers",
        "laptop",
        "notebook",
        "pc",
        "gaming",
        "smartwatch",
        "smart watch",
        "smart-watch",
        "wearable",
        "phone",
        "smartphone",
        "tablet",
        "component",
        "gpu",
        "cpu",
        "monitor",
        "keyboard",
        "software",
        "network",
        "storage",
        "ssd",
        "motherboard",
      ],
      policyHint: "Newegg accepts electronics and computers only",
    },
  };

export const UNKNOWN_CATEGORY_WARNING =
  "Unknown category – verify marketplace suitability.";

export type CategorySupportResult = {
  supported: boolean;
  /** True when category is empty/unknown — all marketplaces allowed with warning. */
  unknownCategory: boolean;
  /** User-facing disabled reason. */
  disabledReason?: string;
  /** Marketplace policy hint for tooltips. */
  policyHint?: string;
};

export type CategoryContext = {
  title?: string;
  /** Extra text used for smartwatch detection on Newegg. */
  description?: string;
};

export function normalizeCategoryText(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isUnknownProductCategory(
  category: string | undefined | null
): boolean {
  const normalized = normalizeCategoryText(category);
  if (!normalized) return true;
  return (
    normalized === "not available" ||
    normalized === "unknown" ||
    normalized === "general" ||
    normalized === "n/a"
  );
}

/** Effective category string for matching (includes title hints for smartwatch). */
export function buildCategoryMatchText(
  category: string | undefined | null,
  context?: CategoryContext
): string {
  const parts = [
    normalizeCategoryText(category),
    normalizeCategoryText(context?.title),
    normalizeCategoryText(context?.description),
  ].filter(Boolean);
  return parts.join(" ");
}

export function categoryMatchesKeywords(
  matchText: string,
  keywords: readonly string[]
): boolean {
  if (!matchText) return false;
  return keywords.some((keyword) => matchText.includes(keyword.toLowerCase()));
}

export function getMarketplaceCategoryRule(
  marketplaceId: string
): MarketplaceCategoryRule | null {
  return MARKETPLACE_CATEGORY_RULES[marketplaceId.toLowerCase()] ?? null;
}

export function evaluateMarketplaceCategorySupport(
  marketplaceId: string,
  category: string | undefined | null,
  context?: CategoryContext
): CategorySupportResult {
  const rule = getMarketplaceCategoryRule(marketplaceId);
  if (!rule) {
    return { supported: true, unknownCategory: isUnknownProductCategory(category) };
  }

  if (isUnknownProductCategory(category)) {
    return {
      supported: true,
      unknownCategory: true,
      policyHint: rule.policyHint,
    };
  }

  const matchText = buildCategoryMatchText(category, context);
  const supported = categoryMatchesKeywords(matchText, rule.allowedKeywords);

  if (supported) {
    return { supported: true, unknownCategory: false, policyHint: rule.policyHint };
  }

  const displayCategory = String(category ?? "").trim() || "this";
  return {
    supported: false,
    unknownCategory: false,
    policyHint: rule.policyHint,
    disabledReason: `Not supported for ${displayCategory} items`,
  };
}

export function isMarketplaceSupportedForCategory(
  marketplaceId: string,
  category: string | undefined | null,
  context?: CategoryContext
): boolean {
  return evaluateMarketplaceCategorySupport(marketplaceId, category, context)
    .supported;
}

export function filterSupportedMarketplaces(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: CategoryContext
): string[] {
  return marketplaceIds.filter((id) =>
    isMarketplaceSupportedForCategory(id, category, context)
  );
}

export function formatMarketplaceCategoryError(
  marketplaceId: string,
  category: string | undefined | null
): string {
  const displayCategory = String(category ?? "").trim() || "unknown";
  const name =
    marketplaceId.charAt(0).toUpperCase() + marketplaceId.slice(1);
  return `Marketplace ${name} does not support category ${displayCategory}`;
}

/** Throws when any marketplace rejects the product category. */
export function assertMarketplacesSupportCategory(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: CategoryContext
): void {
  for (const marketplaceId of marketplaceIds) {
    const result = evaluateMarketplaceCategorySupport(
      marketplaceId,
      category,
      context
    );
    if (!result.supported) {
      throw new Error(formatMarketplaceCategoryError(marketplaceId, category));
    }
  }
}
