/**
 * Pre-listing marketplace policy validation — driven by marketplacePolicies.json.
 * Hard blocks reject publish; conditional rules with severity "warn" flag only.
 */
import policiesDocument from "./marketplacePolicies.json";
import {
  buildCategoryMatchText,
  categoryMatchesKeywords,
  isUnknownProductCategory,
  type CategoryContext,
} from "./marketplaceCategoryUtils";

export type PolicySeverity = "warn" | "reject";

export type MarketplaceConditionalRule = {
  id: string;
  matchKeywords: string[];
  minPriceUsd?: number;
  maxPriceUsd?: number;
  severity: PolicySeverity;
  message: string;
};

export type MarketplacePolicy = {
  allowedKeywords: string[];
  policyHint: string;
  conditionalRules?: MarketplaceConditionalRule[];
};

export type MarketplacePoliciesDocument = {
  version: number;
  marketplaces: Record<string, MarketplacePolicy>;
};

export const MARKETPLACE_POLICIES = policiesDocument as MarketplacePoliciesDocument;

let marketplacePoliciesOverride: MarketplacePoliciesDocument | null = null;

/** Optional runtime policies (e.g. from GET /api/marketplaces/blocked-keywords). */
export function setMarketplacePoliciesOverride(
  document: MarketplacePoliciesDocument | null
): void {
  marketplacePoliciesOverride = document;
}

function activeMarketplacePolicies(): MarketplacePoliciesDocument {
  return marketplacePoliciesOverride ?? MARKETPLACE_POLICIES;
}

export type ListingPolicyContext = CategoryContext & {
  priceUsd?: number | null;
};

export type PreListingPolicyWarning = {
  marketplaceId: string;
  ruleId: string;
  message: string;
};

export type PreListingValidationResult = {
  /** false only for hard category/policy rejections */
  allowed: boolean;
  unknownCategory: boolean;
  policyHint?: string;
  rejectionReason?: string;
  warnings: PreListingPolicyWarning[];
};

export function getMarketplacePolicy(
  marketplaceId: string
): MarketplacePolicy | null {
  return (
    activeMarketplacePolicies().marketplaces[marketplaceId.toLowerCase()] ?? null
  );
}

/** @deprecated Use getMarketplacePolicy — kept for category support compat. */
export function getMarketplaceCategoryRuleFromPolicies(
  marketplaceId: string
): { allowedKeywords: string[]; policyHint: string } | null {
  const policy = getMarketplacePolicy(marketplaceId);
  if (!policy) return null;
  return {
    allowedKeywords: policy.allowedKeywords,
    policyHint: policy.policyHint,
  };
}

function resolvePriceUsd(priceUsd?: number | null): number | null {
  if (priceUsd == null || Number.isNaN(priceUsd)) return null;
  return priceUsd;
}

function evaluateConditionalRules(
  marketplaceId: string,
  policy: MarketplacePolicy,
  matchText: string,
  priceUsd: number | null
): Pick<PreListingValidationResult, "allowed" | "warnings" | "rejectionReason"> {
  const warnings: PreListingPolicyWarning[] = [];
  let allowed = true;
  let rejectionReason: string | undefined;

  for (const rule of policy.conditionalRules ?? []) {
    if (!categoryMatchesKeywords(matchText, rule.matchKeywords)) continue;

    const meetsMin =
      rule.minPriceUsd == null ||
      (priceUsd != null && priceUsd >= rule.minPriceUsd);
    const meetsMax =
      rule.maxPriceUsd == null ||
      (priceUsd != null && priceUsd <= rule.maxPriceUsd);

    if (!meetsMin || !meetsMax) continue;

    if (rule.severity === "reject") {
      allowed = false;
      rejectionReason = rule.message;
      break;
    }

    warnings.push({
      marketplaceId,
      ruleId: rule.id,
      message: rule.message,
    });
  }

  return { allowed, warnings, rejectionReason };
}

/**
 * Pre-listing validation for a single marketplace.
 * Warn-only conditional rules never set allowed=false.
 */
export function validatePreListingPolicy(
  marketplaceId: string,
  category: string | undefined | null,
  context?: ListingPolicyContext
): PreListingValidationResult {
  const policy = getMarketplacePolicy(marketplaceId);
  const priceUsd = resolvePriceUsd(context?.priceUsd);

  if (!policy) {
    return {
      allowed: true,
      unknownCategory: isUnknownProductCategory(category),
      warnings: [],
    };
  }

  if (isUnknownProductCategory(category)) {
    return {
      allowed: true,
      unknownCategory: true,
      policyHint: policy.policyHint,
      warnings: [],
    };
  }

  const matchText = buildCategoryMatchText(category, context);
  const categoryAllowed = categoryMatchesKeywords(
    matchText,
    policy.allowedKeywords
  );

  if (!categoryAllowed) {
    const displayCategory = String(category ?? "").trim() || "this";
    return {
      allowed: false,
      unknownCategory: false,
      policyHint: policy.policyHint,
      rejectionReason: `Not supported for ${displayCategory} items`,
      warnings: [],
    };
  }

  const conditional = evaluateConditionalRules(
    marketplaceId,
    policy,
    matchText,
    priceUsd
  );

  if (!conditional.allowed) {
    return {
      allowed: false,
      unknownCategory: false,
      policyHint: policy.policyHint,
      rejectionReason: conditional.rejectionReason,
      warnings: [],
    };
  }

  return {
    allowed: true,
    unknownCategory: false,
    policyHint: policy.policyHint,
    warnings: conditional.warnings,
  };
}

export function validatePreListingPolicies(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
): {
  results: PreListingValidationResult[];
  warnings: PreListingPolicyWarning[];
  rejected: Array<{ marketplaceId: string; reason: string }>;
} {
  const results = marketplaceIds.map((marketplaceId) =>
    validatePreListingPolicy(marketplaceId, category, context)
  );

  const warnings = results.flatMap((r) => r.warnings);
  const rejected = marketplaceIds
    .map((marketplaceId, index) => {
      const result = results[index];
      if (result.allowed || !result.rejectionReason) return null;
      return { marketplaceId, reason: result.rejectionReason };
    })
    .filter((entry): entry is { marketplaceId: string; reason: string } =>
      Boolean(entry)
    );

  return { results, warnings, rejected };
}

/** Server-side: log warn-only policy hits for operational review. */
export function logPreListingPolicyWarnings(
  warnings: readonly PreListingPolicyWarning[]
): void {
  for (const warning of warnings) {
    console.warn(
      `[PreListingPolicy] marketplace=${warning.marketplaceId} rule=${warning.ruleId} ${warning.message}`
    );
  }
}

export function parseListingPriceUsd(
  price: string | number | undefined | null
): number | null {
  if (price == null || price === "") return null;
  const parsed =
    typeof price === "number" ? price : Number.parseFloat(String(price));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
