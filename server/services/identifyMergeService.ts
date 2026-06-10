/**
 * Vision + scraper merge rules — keep title, brand, condition, and price consistent.
 */

import { brandsConflict } from "../scrapers/listingUtils";
import {
  detectLuxuryProfile,
  isPriceSaneForLuxury,
  type LuxuryProfile,
} from "../scrapers/luxuryPricing";
import type { VisionConfidence, VisionProduct } from "../visionMerge";

const CONDITION_VALUES = ["New", "Like New", "Used", "Fair"] as const;
export type NormalizedCondition = (typeof CONDITION_VALUES)[number];

export type ScrapedListingLike = {
  title?: string;
  brand?: string;
  condition?: string;
  price?: string | number;
  medianPrice?: string | number;
  isExactMatch?: boolean;
  matchType?: string;
};

export type IdentificationWarnings = {
  lowBrandConfidence: boolean;
  brandMismatch: boolean;
  titleBrandMismatch: boolean;
  scraperBrandRejected: boolean;
  priceRejectedAsWrongProduct: boolean;
  messages: string[];
};

/** Condition must be New | Used | Like New | Fair — never "Used Rolex". */
export function normalizeIdentificationCondition(
  condition: unknown,
  brand?: string
): NormalizedCondition {
  let s = String(condition ?? "").trim();
  if (!s) return "Used";

  const brandToken = String(brand ?? "").trim();
  if (brandToken) {
    const re = new RegExp(`\\b${escapeRegExp(brandToken)}\\b`, "gi");
    s = s.replace(re, " ").replace(/\s+/g, " ").trim();
  }

  const lower = s.toLowerCase();
  if (lower.includes("like new") || lower.includes("like-new") || lower === "mint") {
    return "Like New";
  }
  if (/\bnew\b/.test(lower) && !/\bused\b/.test(lower)) return "New";
  if (/\bused\b/.test(lower) || lower.includes("pre-owned") || lower.includes("preowned")) {
    return "Used";
  }
  if (lower.includes("fair") || lower.includes("vintage")) return "Fair";

  for (const value of CONDITION_VALUES) {
    if (lower === value.toLowerCase()) return value;
  }

  return "Used";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function visionScraperBrandConflict(
  visionBrand: string | undefined,
  scraperBrand: string | undefined,
  scraperTitle?: string
): boolean {
  return brandsConflict(visionBrand, scraperBrand, scraperTitle);
}

export function shouldRejectScraperProduct(
  vision: VisionProduct,
  scraper: ScrapedListingLike | null | undefined
): boolean {
  if (!scraper) return false;
  const scraperBrand = String(scraper.brand ?? "").trim();
  const scraperTitle = String(scraper.title ?? "").trim();
  if (!scraperBrand && !scraperTitle) return false;

  const conflict = visionScraperBrandConflict(
    vision.brand,
    scraperBrand,
    scraperTitle
  );
  if (!conflict) return false;

  const luxury = detectLuxuryProfile(vision.brand, vision.title);
  if (luxury?.isLuxuryWatch) return true;
  if (vision.confidence === "high" && String(vision.brand ?? "").trim()) {
    return true;
  }
  if (vision.confidence === "medium" && String(vision.brand ?? "").trim()) {
    return true;
  }
  return false;
}

export function shouldUseScraperPricing(
  vision: VisionProduct,
  scraper: ScrapedListingLike,
  overrideAllowed: boolean,
  luxury: LuxuryProfile | null
): boolean {
  if (shouldRejectScraperProduct(vision, scraper)) return false;
  if (!overrideAllowed) {
    if (luxury?.isLuxuryWatch) return false;
    if (
      visionScraperBrandConflict(
        vision.brand,
        scraper.brand,
        scraper.title
      )
    ) {
      return false;
    }
  }

  const price =
    parseFloat(String(scraper.medianPrice ?? scraper.price ?? 0)) || 0;
  if (price <= 0) return false;

  if (luxury?.isLuxuryWatch) {
    return isPriceSaneForLuxury(price, luxury);
  }

  return price >= 5;
}

export function resolveFinalBrand(
  vision: VisionProduct,
  scraper: ScrapedListingLike | null | undefined,
  currentBrand: string
): string {
  const visionBrand = String(vision.brand ?? "").trim();
  if (!scraper) return currentBrand || visionBrand;

  if (shouldRejectScraperProduct(vision, scraper)) {
    return visionBrand || currentBrand;
  }

  return currentBrand || visionBrand;
}

export function resolveFinalTitle(
  vision: VisionProduct,
  scraper: ScrapedListingLike | null | undefined,
  currentTitle: string
): string {
  const visionTitle = String(vision.title ?? "").trim();
  if (!scraper) return currentTitle || visionTitle;

  if (shouldRejectScraperProduct(vision, scraper)) {
    return visionTitle || currentTitle;
  }

  return currentTitle || visionTitle;
}

export function titleMentionsBrand(title: string, brand: string): boolean {
  const t = String(title ?? "").trim().toLowerCase();
  const b = String(brand ?? "").trim().toLowerCase();
  if (!t || !b) return false;
  return t.includes(b);
}

export function computeIdentificationWarnings(input: {
  vision: VisionProduct;
  finalTitle: string;
  finalBrand: string;
  finalCondition: string;
  scraper: ScrapedListingLike | null | undefined;
  scraperRejected: boolean;
  priceRejected: boolean;
}): IdentificationWarnings {
  const messages: string[] = [];
  const visionBrand = String(input.vision.brand ?? "").trim();
  const finalBrand = String(input.finalBrand ?? "").trim();
  const finalTitle = String(input.finalTitle ?? "").trim();

  const lowBrandConfidence =
    input.vision.confidence === "low" ||
    (!visionBrand && input.vision.confidence !== "high");

  if (lowBrandConfidence) {
    messages.push(
      "Brand identification is uncertain — please verify the brand manually before publishing."
    );
  }

  const brandMismatch =
    Boolean(visionBrand && finalBrand) &&
    visionBrand.toLowerCase() !== finalBrand.toLowerCase() &&
    !finalBrand.toLowerCase().includes(visionBrand.toLowerCase()) &&
    !visionBrand.toLowerCase().includes(finalBrand.toLowerCase());

  if (brandMismatch) {
    messages.push(
      `Brand may be incorrect (vision: ${visionBrand}, final: ${finalBrand}). Please confirm before publishing.`
    );
  }

  const titleBrandMismatch =
    Boolean(finalBrand) &&
    !titleMentionsBrand(finalTitle, finalBrand);

  if (titleBrandMismatch) {
    messages.push(
      `Title does not mention brand "${finalBrand}" — please review listing details.`
    );
  }

  if (input.scraperRejected) {
    messages.push(
      "Marketplace search returned a different product brand — using photo identification instead."
    );
  }

  if (input.priceRejected) {
    messages.push(
      "Marketplace price was ignored because it did not match the identified product."
    );
  }

  if (
    normalizeIdentificationCondition(input.finalCondition, finalBrand) !==
    normalizeIdentificationCondition(input.finalCondition)
  ) {
    messages.push("Condition was normalized to a standard value.");
  }

  return {
    lowBrandConfidence,
    brandMismatch,
    titleBrandMismatch,
    scraperBrandRejected: input.scraperRejected,
    priceRejectedAsWrongProduct: input.priceRejected,
    messages,
  };
}

export function logIdentifyPipelineStage(
  stage: string,
  data: Record<string, unknown>
): void {
  console.log(`[IdentifyPipeline][${stage}]`, JSON.stringify(data));
}
