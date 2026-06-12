/**
 * Marketplace listing rule engine — conditional policies per channel.
 * Config source: shared/marketplaceListingRules.json (overridable at runtime).
 */
import rulesDocument from "./marketplaceListingRules.json";
import {
  buildCategoryMatchText,
  categoryMatchesKeywords,
  normalizeCategoryText,
} from "./marketplaceCategoryUtils";
import { parseListingPriceUsd } from "./marketplacePolicyValidation";

export type ListingConditionalRule = {
  id: string;
  matchKeywords?: string[];
  matchItemTypes?: string[];
  matchCategories?: string[];
  minPriceUsd?: number;
  maxPriceUsd?: number;
  allowKeywords?: string[];
  message: string;
};

export type MarketplaceListingRuleSet = {
  policyHint?: string;
  blockedKeywords?: string[];
  blockedCategories?: string[];
  blockedItemTypes?: string[];
  maxPrice?: number;
  requiresAttributes?: string[];
  allowedKeywords?: string[];
  conditionalRules?: ListingConditionalRule[];
};

export type MarketplaceListingRulesDocument = {
  version: number;
  marketplaces: Record<string, MarketplaceListingRuleSet>;
};

export type ListingDraft = {
  title?: string;
  description?: string;
  price?: string | number | null;
  category?: string;
  condition?: string;
  brand?: string;
  material?: string;
  model?: string;
  attributes?: Record<string, unknown>;
};

export const MARKETPLACE_LISTING_RULES =
  rulesDocument as MarketplaceListingRulesDocument;

let listingRulesOverride: MarketplaceListingRulesDocument | null = null;

export function setMarketplaceListingRulesOverride(
  document: MarketplaceListingRulesDocument | null
): void {
  listingRulesOverride = document;
}

export function getMarketplaceListingRulesDocument(): MarketplaceListingRulesDocument {
  return listingRulesOverride ?? MARKETPLACE_LISTING_RULES;
}

export function getMarketplaceListingRuleSet(
  marketplaceId: string
): MarketplaceListingRuleSet | null {
  const id = marketplaceId.trim().toLowerCase();
  return getMarketplaceListingRulesDocument().marketplaces[id] ?? null;
}

function formatMarketplaceLabel(marketplaceId: string): string {
  return marketplaceId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolvePriceUsd(draft: ListingDraft): number | null {
  const fromDraft = parseListingPriceUsd(draft.price);
  if (fromDraft != null) return fromDraft;
  const attrs = draft.attributes;
  if (attrs && typeof attrs === "object") {
    const attrPrice = attrs.price ?? attrs.listPrice ?? attrs.salePrice;
    return parseListingPriceUsd(attrPrice as string | number | null | undefined);
  }
  return null;
}

function buildListingMatchText(draft: ListingDraft): string {
  return buildCategoryMatchText(draft.category, {
    title: draft.title,
    description: draft.description,
  });
}

function getDraftAttribute(draft: ListingDraft, key: string): string {
  const direct = (draft as Record<string, unknown>)[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const fromAttrs = draft.attributes?.[key];
  if (typeof fromAttrs === "string" && fromAttrs.trim()) return fromAttrs.trim();
  return "";
}

function hasAllowKeywordEscape(matchText: string, allowKeywords?: string[]): boolean {
  if (!allowKeywords?.length) return false;
  return categoryMatchesKeywords(matchText, allowKeywords);
}

function categoryMatchesBlocked(
  category: string | undefined | null,
  blockedCategories: readonly string[]
): string | null {
  const normalized = normalizeCategoryText(category);
  if (!normalized) return null;
  for (const blocked of blockedCategories) {
    const needle = blocked.toLowerCase();
    if (normalized.includes(needle) || needle.includes(normalized)) {
      return blocked;
    }
  }
  return null;
}

function evaluateConditionalRules(
  marketplaceId: string,
  rules: MarketplaceListingRuleSet,
  draft: ListingDraft,
  matchText: string,
  priceUsd: number | null
): string | null {
  for (const rule of rules.conditionalRules ?? []) {
    const keywordHit =
      !rule.matchKeywords?.length ||
      categoryMatchesKeywords(matchText, rule.matchKeywords);
    const itemTypeHit =
      !rule.matchItemTypes?.length ||
      categoryMatchesKeywords(matchText, rule.matchItemTypes);
    const categoryHit =
      !rule.matchCategories?.length ||
      categoryMatchesBlocked(draft.category, rule.matchCategories) != null;

    if (!keywordHit || !itemTypeHit || !categoryHit) continue;
    if (hasAllowKeywordEscape(matchText, rule.allowKeywords)) continue;

    const meetsMin =
      rule.minPriceUsd == null ||
      (priceUsd != null && priceUsd >= rule.minPriceUsd);
    const meetsMax =
      rule.maxPriceUsd == null ||
      (priceUsd != null && priceUsd <= rule.maxPriceUsd);

    if (!meetsMin || !meetsMax) continue;

    return rule.message;
  }
  return null;
}

/**
 * Returns a human-readable block reason, or null when the listing may be published.
 */
export function getBlockReason(
  marketplaceId: string,
  draft: ListingDraft
): string | null {
  const rules = getMarketplaceListingRuleSet(marketplaceId);
  if (!rules) return null;

  const label = formatMarketplaceLabel(marketplaceId);
  const matchText = buildListingMatchText(draft);
  const priceUsd = resolvePriceUsd(draft);

  for (const attr of rules.requiresAttributes ?? []) {
    if (!getDraftAttribute(draft, attr)) {
      return `${label}: ${attr} is required for listings on this marketplace`;
    }
  }

  const blockedCategory = categoryMatchesBlocked(
    draft.category,
    rules.blockedCategories ?? []
  );
  if (blockedCategory) {
    return `${label}: category "${blockedCategory}" is not allowed`;
  }

  for (const itemType of rules.blockedItemTypes ?? []) {
    if (categoryMatchesKeywords(matchText, [itemType])) {
      return `${label}: ${itemType} items are not allowed`;
    }
  }

  for (const keyword of rules.blockedKeywords ?? []) {
    if (!categoryMatchesKeywords(matchText, [keyword])) continue;
    const escapedByConditional = (rules.conditionalRules ?? []).some(
      (rule) =>
        categoryMatchesKeywords(matchText, rule.matchKeywords ?? [keyword]) &&
        hasAllowKeywordEscape(matchText, rule.allowKeywords)
    );
    if (escapedByConditional) continue;
    return `${label}: does not allow items containing '${keyword}'`;
  }

  if (rules.allowedKeywords?.length) {
    const allowed = categoryMatchesKeywords(matchText, rules.allowedKeywords);
    if (!allowed) {
      return `${label}: ${rules.policyHint ?? "this item type is not supported"}`;
    }
  }

  if (rules.maxPrice != null && priceUsd != null && priceUsd > rules.maxPrice) {
    return `${label}: maximum price is $${rules.maxPrice}`;
  }

  const conditionalBlock = evaluateConditionalRules(
    marketplaceId,
    rules,
    draft,
    matchText,
    priceUsd
  );
  if (conditionalBlock) return conditionalBlock;

  return null;
}

export function listingDraftFromFields(fields: {
  title?: string;
  description?: string;
  price?: string | number | null;
  category?: string;
  condition?: string;
  brand?: string;
  material?: string;
  model?: string;
  attributes?: Record<string, unknown>;
}): ListingDraft {
  return {
    title: fields.title,
    description: fields.description,
    price: fields.price,
    category: fields.category,
    condition: fields.condition,
    brand: fields.brand,
    material: fields.material,
    model: fields.model,
    attributes: fields.attributes,
  };
}

export function listingDraftFromPublishPayload(payload: {
  title: string;
  attributes?: Record<string, unknown>;
}): ListingDraft {
  const attrs = payload.attributes ?? {};
  return listingDraftFromFields({
    title: payload.title,
    description: String(
      attrs.longDescription ?? attrs.aiDescription ?? attrs.description ?? ""
    ),
    price:
      (attrs.price as string | number | undefined) ??
      (attrs.listPrice as string | number | undefined),
    category: String(
      attrs.category ?? attrs.categoryNode ?? attrs.productCategory ?? ""
    ),
    condition: String(attrs.condition ?? ""),
    brand: String(attrs.brand ?? ""),
    material: String(attrs.material ?? ""),
    model: String(attrs.model ?? ""),
    attributes: attrs,
  });
}

export function filterAllowedMarketplacesForDraft(
  marketplaceIds: readonly string[],
  draft: ListingDraft
): string[] {
  return marketplaceIds.filter((id) => getBlockReason(id, draft) == null);
}

export function assertMarketplacesAllowDraft(
  marketplaceIds: readonly string[],
  draft: ListingDraft
): void {
  for (const marketplaceId of marketplaceIds) {
    const reason = getBlockReason(marketplaceId, draft);
    if (reason) throw new Error(reason);
  }
}
