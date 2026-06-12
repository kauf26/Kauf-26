/**
 * Unified marketplace keyword / category restriction API for web and mobile.
 * Policy source of truth: shared/marketplacePolicies.json
 */
import {
  evaluateMarketplaceCategorySupport,
  filterSupportedMarketplaces,
  formatMarketplaceCategoryError,
  assertMarketplacesSupportCategory,
  isUnknownProductCategory,
  UNKNOWN_CATEGORY_WARNING,
  type CategorySupportResult,
  type CategoryContext,
} from "./marketplaceCategorySupport";
import {
  MARKETPLACE_POLICIES,
  validatePreListingPolicy,
  validatePreListingPolicies,
  parseListingPriceUsd,
  setMarketplacePoliciesOverride,
  type ListingPolicyContext,
  type MarketplacePoliciesDocument,
  type PreListingPolicyWarning,
} from "./marketplacePolicyValidation";

export type { MarketplacePoliciesDocument };

export type MarketplaceKeywordPolicy = {
  allowedKeywords: string[];
  policyHint: string;
};

export type MarketplaceKeywordPoliciesMap = Record<string, MarketplaceKeywordPolicy>;

/**
 * Representative blocked keywords per marketplace (used for UI tooltips and text scans).
 * Full policy validation also uses allowed-keyword whitelists in marketplacePolicies.json.
 */
export const MARKETPLACE_BLOCKED_KEYWORDS: Record<string, readonly string[]> = {
  stockx: [
    "watch",
    "watches",
    "rolex",
    "omega",
    "handbag",
    "furniture",
    "clothing",
    "electronics",
    "jewelry",
  ],
  wayfair: [
    "watch",
    "watches",
    "sneaker",
    "sneakers",
    "shoes",
    "clothing",
    "electronics",
    "jewelry",
    "handbag",
  ],
  newegg: ["clothing", "furniture", "handbag", "jewelry", "apparel", "dress"],
  poshmark: [],
};

export type MarketplaceRestrictionResult = CategorySupportResult & {
  marketplaceId: string;
  matchedBlockedKeywords?: string[];
};

export {
  UNKNOWN_CATEGORY_WARNING,
  type CategoryContext,
  type ListingPolicyContext,
  type PreListingPolicyWarning,
  filterSupportedMarketplaces,
  formatMarketplaceCategoryError,
  assertMarketplacesSupportCategory,
  isUnknownProductCategory,
  parseListingPriceUsd,
  setMarketplacePoliciesOverride,
  validatePreListingPolicy,
  validatePreListingPolicies,
};

/** Bundled keyword policies (same payload as GET /api/marketplaces/blocked-keywords). */
export function getMarketplaceKeywordPolicies(): MarketplaceKeywordPoliciesMap {
  return Object.fromEntries(
    Object.entries(MARKETPLACE_POLICIES.marketplaces).map(([id, policy]) => [
      id,
      {
        allowedKeywords: [...policy.allowedKeywords],
        policyHint: policy.policyHint,
      },
    ])
  );
}

/**
 * Keyword restriction map for API clients (allowed-keyword whitelists).
 * Marketplaces without entries have no keyword whitelist (all categories allowed).
 */
export function getBlockedKeywords(): MarketplaceKeywordPoliciesMap {
  return getMarketplaceKeywordPolicies();
}

/** Explicit blocked keyword hints keyed by marketplace id (lowercase). */
export function getMarketplaceBlockedKeywordMap(): Record<string, readonly string[]> {
  return MARKETPLACE_BLOCKED_KEYWORDS;
}

export function findBlockedKeywordMatches(
  marketplaceId: string,
  text: string | undefined | null
): string[] {
  const blocked = MARKETPLACE_BLOCKED_KEYWORDS[marketplaceId.toLowerCase()];
  if (!blocked?.length || !text) return [];
  const normalized = text.toLowerCase();
  return blocked.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function buildListingMatchText(
  category: string | undefined | null,
  context?: ListingPolicyContext
): string {
  return [
    String(category ?? ""),
    context?.title ?? "",
    context?.description ?? "",
  ]
    .join(" ")
    .trim();
}

export function getMarketplaceKeywordPoliciesDocument(): MarketplacePoliciesDocument {
  return MARKETPLACE_POLICIES;
}

export function buildListingPolicyContext(input: {
  title?: string;
  description?: string;
  price?: string | number | null;
}): ListingPolicyContext {
  return {
    title: input.title,
    description: input.description,
    priceUsd: parseListingPriceUsd(input.price),
  };
}

/** @alias evaluateMarketplaceCategorySupport */
export function checkMarketplaceRestrictions(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): MarketplaceRestrictionResult {
  const result = evaluateMarketplaceCategorySupport(marketplaceId, category, context);
  const matchText = buildListingMatchText(category, context);
  const matchedBlockedKeywords = findBlockedKeywordMatches(marketplaceId, matchText);

  if (!result.supported) {
    return { marketplaceId, ...result, matchedBlockedKeywords };
  }

  if (matchedBlockedKeywords.length > 0) {
    const label = marketplaceId.charAt(0).toUpperCase() + marketplaceId.slice(1);
    const keyword = matchedBlockedKeywords[0];
    return {
      marketplaceId,
      supported: false,
      unknownCategory: result.unknownCategory,
      disabledReason: `${label} does not allow items containing '${keyword}'`,
      policyHint: result.policyHint,
      warnings: result.warnings,
      matchedBlockedKeywords,
    };
  }

  return { marketplaceId, ...result, matchedBlockedKeywords };
}

/** Returns true when the listing is blocked for this marketplace. */
export function isKeywordBlocked(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): boolean {
  return !checkMarketplaceRestrictions(marketplaceId, category, context).supported;
}

export function getMarketplaceRestrictionMessage(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): string | undefined {
  const result = checkMarketplaceRestrictions(marketplaceId, category, context);
  if (result.supported) return undefined;
  return [result.disabledReason, result.policyHint].filter(Boolean).join(" — ");
}

export function filterAllowedMarketplaces(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
): string[] {
  return marketplaceIds.filter(
    (id) => checkMarketplaceRestrictions(id, category, context).supported
  );
}

/** Server/mobile: throw when any marketplace blocks keywords or category. */
export function assertMarketplacesAllowListing(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
): void {
  for (const marketplaceId of marketplaceIds) {
    const result = checkMarketplaceRestrictions(marketplaceId, category, context);
    if (!result.supported) {
      throw new Error(
        result.disabledReason ??
          formatMarketplaceCategoryError(marketplaceId, category)
      );
    }
  }
}
