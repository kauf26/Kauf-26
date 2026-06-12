/**
 * Marketplace listing eligibility — rules loaded from config/marketplace-rules.json only.
 * No marketplace-specific rule values are defined in this file.
 */
import fs from "node:fs";
import path from "node:path";
import { getEnabledMarketplaceIds } from "../config/marketplaces";

export type ConditionalPriceRule = {
  matchKeywords: string[];
  maxPrice: number;
  reason: string;
};

export type ConditionalKeywordRule = {
  matchKeywords: string[];
  unlessKeywords?: string[];
  reason: string;
};

export type RequireAnyAttributeRule = {
  attributes: string[];
  fallbackKeywords?: string[];
  reason?: string;
};

export type MarketplaceMessages = {
  blockedCategory?: string;
  blockedItemType?: string;
  blockedKeyword?: string;
  allowedItemTypes?: string;
  maxPrice?: string;
  requireAnyAttribute?: string;
  generic?: string;
};

export type MarketplaceRuleSet = {
  messages?: MarketplaceMessages;
  keywordReasons?: Record<string, string>;
  blockedKeywords?: string[];
  maxPrice?: number;
  blockedCategories?: string[];
  blockedItemTypes?: string[];
  allowedItemTypes?: string[];
  keywordExceptions?: string[];
  conditionalPriceRules?: ConditionalPriceRule[];
  conditionalKeywordRules?: ConditionalKeywordRule[];
  requireAnyAttribute?: RequireAnyAttributeRule;
};

export type MarketplaceRulesDocument = {
  version: number;
  genericBlockReason?: string;
  marketplaces: Record<string, MarketplaceRuleSet>;
};

export type EligibilityDraft = {
  title?: string;
  description?: string;
  price?: string | number | null;
  category?: string;
  condition?: string;
  brand?: string;
  attributes?: Record<string, unknown>;
};

export type EligibilityResult = {
  marketplaceId: string;
  allowed: boolean;
  reason: string | null;
};

const DEFAULT_RULES_PATH = path.resolve(
  process.cwd(),
  "config",
  "marketplace-rules.json"
);

let rulesCache: MarketplaceRulesDocument | null = null;
let activeRulesPath = process.env.MARKETPLACE_RULES_PATH ?? DEFAULT_RULES_PATH;

export function getMarketplaceRulesPath(): string {
  return activeRulesPath;
}

export function loadMarketplaceRulesFromFile(
  rulesPath: string = activeRulesPath
): MarketplaceRulesDocument {
  const raw = fs.readFileSync(rulesPath, "utf8");
  const parsed = JSON.parse(raw) as MarketplaceRulesDocument;
  if (!parsed.marketplaces || typeof parsed.marketplaces !== "object") {
    throw new Error("marketplace-rules.json: missing marketplaces object");
  }
  rulesCache = parsed;
  activeRulesPath = rulesPath;
  console.info(
    `[Eligibility] Loaded marketplace rules v${parsed.version ?? 1} from ${rulesPath}`
  );
  return parsed;
}

/** Load rules on first use or after reload. */
export function getMarketplaceRules(): MarketplaceRulesDocument {
  if (!rulesCache) {
    loadMarketplaceRulesFromFile();
  }
  return rulesCache!;
}

export function reloadMarketplaceRules(): MarketplaceRulesDocument {
  rulesCache = null;
  return loadMarketplaceRulesFromFile();
}

export function initMarketplaceEligibility(): void {
  loadMarketplaceRulesFromFile();
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function parsePriceUsd(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildMatchText(draft: EligibilityDraft): string {
  return [
    normalizeText(draft.category),
    normalizeText(draft.title),
    normalizeText(draft.description),
    normalizeText(draft.brand),
    normalizeText(draft.condition),
  ]
    .filter(Boolean)
    .join(" ");
}

function textIncludesKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase());
}

function matchesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => textIncludesKeyword(text, keyword));
}

function resolveBlockReason(
  doc: MarketplaceRulesDocument,
  rules: MarketplaceRuleSet,
  messageKey: keyof MarketplaceMessages,
  keyword?: string
): string {
  if (keyword && rules.keywordReasons?.[keyword]) {
    return rules.keywordReasons[keyword];
  }
  const fromMessages = rules.messages?.[messageKey];
  if (fromMessages) return fromMessages;
  if (rules.messages?.generic) return rules.messages.generic;
  return doc.genericBlockReason ?? "";
}

function getAttributeValue(
  draft: EligibilityDraft,
  attributeName: string
): unknown {
  const key = attributeName.trim();
  const fromAttrs = draft.attributes?.[key];
  if (fromAttrs != null && fromAttrs !== "") return fromAttrs;
  const camel = key.charAt(0).toLowerCase() + key.slice(1);
  return draft.attributes?.[camel];
}

function isTruthyAttribute(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  return false;
}

function evaluateRules(
  doc: MarketplaceRulesDocument,
  rules: MarketplaceRuleSet,
  draft: EligibilityDraft
): string | null {
  const matchText = buildMatchText(draft);
  const priceUsd = parsePriceUsd(draft.price);

  if (rules.requireAnyAttribute) {
    const { attributes, fallbackKeywords = [], reason } = rules.requireAnyAttribute;
    const hasAttribute = attributes.some((name) =>
      isTruthyAttribute(getAttributeValue(draft, name))
    );
    const hasFallback = matchesAnyKeyword(matchText, fallbackKeywords);
    if (!hasAttribute && !hasFallback) {
      return (
        reason ??
        resolveBlockReason(doc, rules, "requireAnyAttribute")
      );
    }
  }

  if (rules.blockedCategories?.length) {
    const category = normalizeText(draft.category);
    for (const blocked of rules.blockedCategories) {
      const needle = blocked.toLowerCase();
      if (category.includes(needle) || needle.includes(category)) {
        return resolveBlockReason(doc, rules, "blockedCategory", needle);
      }
    }
  }

  if (rules.blockedItemTypes?.length && matchesAnyKeyword(matchText, rules.blockedItemTypes)) {
    const hit = rules.blockedItemTypes.find((itemType) =>
      textIncludesKeyword(matchText, itemType)
    );
    return resolveBlockReason(doc, rules, "blockedItemType", hit);
  }

  for (const keyword of rules.blockedKeywords ?? []) {
    if (!textIncludesKeyword(matchText, keyword)) continue;
    if (matchesAnyKeyword(matchText, rules.keywordExceptions ?? [])) continue;
    return resolveBlockReason(doc, rules, "blockedKeyword", keyword);
  }

  for (const rule of rules.conditionalPriceRules ?? []) {
    if (!matchesAnyKeyword(matchText, rule.matchKeywords)) continue;
    if (priceUsd == null || priceUsd <= rule.maxPrice) continue;
    return rule.reason;
  }

  for (const rule of rules.conditionalKeywordRules ?? []) {
    if (!matchesAnyKeyword(matchText, rule.matchKeywords)) continue;
    if (matchesAnyKeyword(matchText, rule.unlessKeywords ?? [])) continue;
    return rule.reason;
  }

  if (rules.maxPrice != null && priceUsd != null && priceUsd > rules.maxPrice) {
    return resolveBlockReason(doc, rules, "maxPrice");
  }

  if (rules.allowedItemTypes?.length && !matchesAnyKeyword(matchText, rules.allowedItemTypes)) {
    return resolveBlockReason(doc, rules, "allowedItemTypes");
  }

  return null;
}

export function getEligibilityReason(
  marketplaceId: string,
  draft: EligibilityDraft
): string | null {
  const id = marketplaceId.trim().toLowerCase();
  const doc = getMarketplaceRules();
  const rules = doc.marketplaces[id];
  if (!rules || Object.keys(rules).length === 0) return null;
  return evaluateRules(doc, rules, draft);
}

export function checkMarketplaceEligibility(
  marketplaceId: string,
  draft: EligibilityDraft
): EligibilityResult {
  const id = marketplaceId.trim().toLowerCase();
  const reason = getEligibilityReason(id, draft);
  return {
    marketplaceId: id,
    allowed: reason == null,
    reason,
  };
}

export function checkEligibilityForMarketplaces(
  draft: EligibilityDraft,
  marketplaceIds: readonly string[]
): EligibilityResult[] {
  return marketplaceIds.map((marketplaceId) =>
    checkMarketplaceEligibility(marketplaceId, draft)
  );
}

export function filterEligibleMarketplaces(
  marketplaceIds: readonly string[],
  draft: EligibilityDraft
): string[] {
  return marketplaceIds.filter((id) => getEligibilityReason(id, draft) == null);
}

export function assertMarketplacesEligible(
  marketplaceIds: readonly string[],
  draft: EligibilityDraft
): void {
  const blocked = checkEligibilityForMarketplaces(draft, marketplaceIds).filter(
    (row) => !row.allowed
  );
  if (blocked.length === 0) return;
  const details = blocked
    .map((row) => `${row.marketplaceId}: ${row.reason}`)
    .join("; ");
  throw new Error(details);
}

export function eligibilityDraftFromFields(fields: EligibilityDraft): EligibilityDraft {
  return { ...fields };
}

export function eligibilityDraftFromPublishPayload(payload: {
  title: string;
  attributes?: Record<string, unknown>;
}): EligibilityDraft {
  const attrs = payload.attributes ?? {};
  return {
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
    attributes: attrs,
  };
}

export function eligibilityDraftFromDbRow(draft: {
  title: string;
  attributes?: unknown;
}): EligibilityDraft {
  const attrs =
    draft.attributes && typeof draft.attributes === "object"
      ? (draft.attributes as Record<string, unknown>)
      : {};
  return eligibilityDraftFromPublishPayload({
    title: draft.title,
    attributes: attrs,
  });
}

export function defaultEligibilityMarketplaceIds(): string[] {
  return getEnabledMarketplaceIds();
}
