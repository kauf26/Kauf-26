import { describe, expect, it } from "vitest";
import { canScraperOverrideVision } from "./exactMatchGate";

describe("canScraperOverrideVision brand conflict", () => {
  it("blocks override when vision Rolex conflicts with scraper Invicta", () => {
    const result = canScraperOverrideVision({
      visionTitle: "Rolex Submariner",
      visionBrand: "Rolex",
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
});
