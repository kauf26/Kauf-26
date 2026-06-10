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
  manualReviewRequired: boolean;
  messages: string[];
};

export type ScraperResolution = {
  useScraper: boolean;
  useScraperPricing: boolean;
  scraperRejected: boolean;
  manualReviewRequired: boolean;
  reasons: string[];
  warnings: string[];
};

export function effectiveBrandConfidence(vision: VisionProduct): VisionConfidence {
  return (
    vision.brandConfidence ??
    (String(vision.brand ?? "").trim() ? vision.confidence : "low")
  );
}

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

/** Scraper usage policy based on vision brand_confidence. */
export function resolveScraperUsage(
  vision: VisionProduct,
  scraper: ScrapedListingLike | null | undefined
): ScraperResolution {
  const brandConfidence = effectiveBrandConfidence(vision);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!scraper) {
    return {
      useScraper: false,
      useScraperPricing: false,
      scraperRejected: false,
      manualReviewRequired:
        brandConfidence === "low" || !String(vision.brand ?? "").trim(),
      reasons: ["no_scraper_result"],
      warnings,
    };
  }

  const conflict = visionScraperBrandConflict(
    vision.brand,
    scraper.brand,
    scraper.title
  );

  if (brandConfidence === "high" && String(vision.brand ?? "").trim()) {
    if (conflict) {
      return {
        useScraper: false,
        useScraperPricing: false,
        scraperRejected: true,
        manualReviewRequired: false,
        reasons: ["high_brand_confidence_conflict"],
        warnings: [
          "Marketplace search returned a different brand and was completely ignored.",
        ],
      };
    }
    return {
      useScraper: true,
      useScraperPricing: true,
      scraperRejected: false,
      manualReviewRequired: false,
      reasons: [],
      warnings,
    };
  }

  if (brandConfidence === "medium") {
    if (conflict) {
      warnings.push(
        "Vision brand uncertain — marketplace data used instead; confirm brand manually."
      );
      return {
        useScraper: true,
        useScraperPricing: true,
        scraperRejected: false,
        manualReviewRequired: true,
        reasons: ["medium_confidence_scraper_override"],
        warnings,
      };
    }
    warnings.push(
      "Brand confidence is medium — please verify the brand before publishing."
    );
    return {
      useScraper: true,
      useScraperPricing: true,
      scraperRejected: false,
      manualReviewRequired: true,
      reasons: [],
      warnings,
    };
  }

  if (conflict) {
    warnings.push(
      "Brand uncertain from photo — marketplace brand used instead; manual review required."
    );
  } else {
    warnings.push(
      "Brand uncertain from photo — using marketplace data where available; manual review required."
    );
  }
  return {
    useScraper: true,
    useScraperPricing: true,
    scraperRejected: false,
    manualReviewRequired: true,
    reasons: conflict
      ? ["low_brand_confidence_scraper_override"]
      : ["low_brand_confidence"],
    warnings,
  };
}

export function shouldRejectScraperProduct(
  vision: VisionProduct,
  scraper: ScrapedListingLike | null | undefined
): boolean {
  return resolveScraperUsage(vision, scraper).scraperRejected;
}

export function shouldUseScraperPricing(
  vision: VisionProduct,
  scraper: ScrapedListingLike,
  overrideAllowed: boolean,
  luxury: LuxuryProfile | null
): boolean {
  const resolution = resolveScraperUsage(vision, scraper);
  if (!resolution.useScraperPricing) return false;
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

  const brandConfidence = effectiveBrandConfidence(vision);
  const scraperBrand = String(scraper.brand ?? "").trim();
  if (
    brandConfidence !== "high" &&
    scraperBrand &&
    visionScraperBrandConflict(visionBrand, scraperBrand, scraper.title)
  ) {
    return scraperBrand || currentBrand || visionBrand;
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

  const brandConfidence = effectiveBrandConfidence(vision);
  const scraperTitle = String(scraper.title ?? "").trim();
  if (
    brandConfidence !== "high" &&
    scraperTitle &&
    visionScraperBrandConflict(
      vision.brand,
      scraper.brand,
      scraper.title
    )
  ) {
    return scraperTitle || currentTitle || visionTitle;
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

  const brandConfidence = effectiveBrandConfidence(input.vision);
  const lowBrandConfidence =
    brandConfidence === "low" ||
    (!visionBrand && brandConfidence !== "high") ||
    (input.vision.hallucinationFlags?.length ?? 0) > 0;

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
    manualReviewRequired:
      lowBrandConfidence ||
      brandMismatch ||
      titleBrandMismatch ||
      input.scraperRejected ||
      input.priceRejected,
    messages,
  };
}

export function logIdentifyPipelineStage(
  stage: string,
  data: Record<string, unknown>
): void {
  console.log(`[IdentifyPipeline][${stage}]`, JSON.stringify(data));
}
