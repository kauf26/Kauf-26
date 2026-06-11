/**
 * Category compatibility rules per marketplace.
 * Policy source of truth: shared/marketplacePolicies.json
 */
import policiesDocument from "./marketplacePolicies.json";
import {
  validatePreListingPolicy,
  type ListingPolicyContext,
} from "./marketplacePolicyValidation";
import {
  UNKNOWN_CATEGORY_WARNING,
  buildCategoryMatchText,
  categoryMatchesKeywords,
  isUnknownProductCategory,
  normalizeCategoryText,
  type CategoryContext,
} from "./marketplaceCategoryUtils";

export type MarketplaceCategoryRule = {
  allowedKeywords: string[];
  policyHint: string;
};

/** Restricted marketplaces from marketplacePolicies.json */
export const MARKETPLACE_CATEGORY_RULES: Record<string, MarketplaceCategoryRule> =
  Object.fromEntries(
    Object.entries(policiesDocument.marketplaces).map(([id, policy]) => [
      id,
      {
        allowedKeywords: policy.allowedKeywords,
        policyHint: policy.policyHint,
      },
    ])
  );

export { UNKNOWN_CATEGORY_WARNING, type CategoryContext, type ListingPolicyContext };

export type CategorySupportResult = {
  supported: boolean;
  unknownCategory: boolean;
  disabledReason?: string;
  policyHint?: string;
  /** Warn-only policy flags (e.g. Poshmark high-value watches). */
  warnings?: string[];
};

export function getMarketplaceCategoryRule(
  marketplaceId: string
): MarketplaceCategoryRule | null {
  return MARKETPLACE_CATEGORY_RULES[marketplaceId.toLowerCase()] ?? null;
}

export function evaluateMarketplaceCategorySupport(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): CategorySupportResult {
  const result = validatePreListingPolicy(marketplaceId, category, context);

  return {
    supported: result.allowed,
    unknownCategory: result.unknownCategory,
    disabledReason: result.rejectionReason,
    policyHint: result.policyHint,
    warnings: result.warnings.map((w) => w.message),
  };
}

export function isMarketplaceSupportedForCategory(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): boolean {
  return evaluateMarketplaceCategorySupport(marketplaceId, category, context)
    .supported;
}

export function filterSupportedMarketplaces(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
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

/** Throws when any marketplace rejects the product category (warn-only rules do not throw). */
export function assertMarketplacesSupportCategory(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
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

export {
  buildCategoryMatchText,
  categoryMatchesKeywords,
  isUnknownProductCategory,
  normalizeCategoryText,
};
