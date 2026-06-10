import { describe, expect, it } from "vitest";
import { canScraperOverrideVision } from "./exactMatchGate";

describe("canScraperOverrideVision brand conflict", () => {
  it("blocks override when vision Rolex conflicts with scraper Invicta at high confidence", () => {
    const result = canScraperOverrideVision({
      visionTitle: "Rolex Submariner",
      visionBrand: "Rolex",
      visionBrandConfidence: "high",
      scraperTitle: "Invicta Pro Diver Watch",
      scraperBrand: "Invicta",
      price: 180,
      isExactMatch: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.startsWith("brand_conflict"))).toBe(
      true
    );
  });

  it("allows override when vision brand confidence is low despite conflict", () => {
    const result = canScraperOverrideVision({
      visionTitle: "Diver Watch",
      visionBrand: "Invicta",
      visionBrandConfidence: "low",
      scraperTitle: "Rolex Submariner Date",
      scraperBrand: "Rolex",
      price: 9500,
      isExactMatch: true,
    });
    expect(result.reasons.some((r) => r.startsWith("brand_conflict"))).toBe(
      false
    );
  });
});
