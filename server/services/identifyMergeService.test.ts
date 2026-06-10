import { describe, expect, it } from "vitest";
import {
  computeIdentificationWarnings,
  normalizeIdentificationCondition,
  resolveFinalBrand,
  resolveScraperUsage,
  shouldRejectScraperProduct,
  shouldUseScraperPricing,
  visionScraperBrandConflict,
} from "./identifyMergeService";
import type { VisionProduct } from "../visionMerge";

const rolexVision: VisionProduct = {
  title: "Rolex Submariner",
  brand: "Rolex",
  brandConfidence: "high",
  model: "Submariner",
  category: "Watches",
  condition: "Used",
  confidence: "high",
};

describe("identifyMergeService", () => {
  it("normalizes condition and strips embedded brand", () => {
    expect(normalizeIdentificationCondition("Used Rolex", "Rolex")).toBe("Used");
    expect(normalizeIdentificationCondition("Like New Rolex", "Rolex")).toBe(
      "Like New"
    );
    expect(normalizeIdentificationCondition("Used")).toBe("Used");
  });

  it("detects vision vs scraper brand conflict", () => {
    expect(
      visionScraperBrandConflict("Rolex", "Invicta", "Invicta Pro Diver Watch")
    ).toBe(true);
    expect(
      visionScraperBrandConflict("Rolex", "Rolex", "Rolex Submariner Date")
    ).toBe(false);
  });

  it("rejects Invicta scraper when vision is high-confidence Rolex", () => {
    expect(
      shouldRejectScraperProduct(rolexVision, {
        title: "Invicta Pro Diver Watch",
        brand: "Invicta",
        price: 180,
        isExactMatch: true,
      })
    ).toBe(true);
  });

  it("does not use Invicta scraper pricing for Rolex vision", () => {
    const scraper = {
      title: "Invicta Pro Diver Watch",
      brand: "Invicta",
      price: 180,
      isExactMatch: true,
    };
    expect(
      shouldUseScraperPricing(rolexVision, scraper, false, null)
    ).toBe(false);
  });

  it("allows scraper override on medium brand_confidence conflict", () => {
    const resolution = resolveScraperUsage(
      { ...rolexVision, brandConfidence: "medium" },
      {
        title: "Invicta Pro Diver Watch",
        brand: "Invicta",
        price: 180,
      }
    );
    expect(resolution.useScraper).toBe(true);
    expect(resolution.scraperRejected).toBe(false);
    expect(resolution.useScraperPricing).toBe(true);
    expect(resolution.manualReviewRequired).toBe(true);
  });

  it("blocks scraper entirely on high brand_confidence conflict", () => {
    const resolution = resolveScraperUsage(rolexVision, {
      title: "Invicta Pro Diver Watch",
      brand: "Invicta",
      price: 180,
    });
    expect(resolution.useScraper).toBe(false);
    expect(resolution.scraperRejected).toBe(true);
  });

  it("computes warnings for brand/title mismatch", () => {
    const warnings = computeIdentificationWarnings({
      vision: rolexVision,
      finalTitle: "Rolex Submariner Date",
      finalBrand: "Invicta",
      finalCondition: "Used Rolex",
      scraper: { brand: "Invicta", title: "Invicta Pro Diver Watch" },
      scraperRejected: true,
      priceRejected: true,
    });
    expect(warnings.brandMismatch).toBe(true);
    expect(warnings.titleBrandMismatch).toBe(true);
    expect(warnings.scraperBrandRejected).toBe(true);
    expect(warnings.messages.length).toBeGreaterThan(0);
  });

  it("prefers scraper brand when vision brand confidence is low", () => {
    const vision: VisionProduct = {
      title: "Diver Watch",
      brand: "Invicta",
      brandConfidence: "low",
      confidence: "medium",
    };
    const brand = resolveFinalBrand(
      vision,
      {
        title: "Rolex Submariner Date",
        brand: "Rolex",
      },
      "Invicta"
    );
    expect(brand).toBe("Rolex");
  });
});
