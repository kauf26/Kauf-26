import { describe, it, expect } from "vitest";
import {
  UNKNOWN_CATEGORY_WARNING,
  assertMarketplacesSupportCategory,
  evaluateMarketplaceCategorySupport,
  filterSupportedMarketplaces,
  isUnknownProductCategory,
} from "./marketplaceCategorySupport";

describe("marketplaceCategorySupport", () => {
  it("allows broad marketplaces for watches", () => {
    expect(
      evaluateMarketplaceCategorySupport("ebay", "Watches").supported
    ).toBe(true);
    expect(
      evaluateMarketplaceCategorySupport("etsy", "Watches").supported
    ).toBe(true);
    expect(
      evaluateMarketplaceCategorySupport("amazon", "Watches").supported
    ).toBe(true);
  });

  it("blocks restricted marketplaces for watches", () => {
    for (const id of ["stockx", "wayfair", "newegg"]) {
      const result = evaluateMarketplaceCategorySupport(id, "Watches");
      expect(result.supported).toBe(false);
      expect(result.disabledReason).toContain("Watches");
    }
  });

  it("allows Poshmark for watches with optional high-value warning", () => {
    const result = evaluateMarketplaceCategorySupport("poshmark", "Watches", {
      priceUsd: 600,
    });
    expect(result.supported).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("allows StockX for footwear categories", () => {
    expect(
      evaluateMarketplaceCategorySupport("stockx", "Sneakers").supported
    ).toBe(true);
    expect(
      evaluateMarketplaceCategorySupport("stockx", "Shoes").supported
    ).toBe(true);
  });

  it("allows Newegg for smartwatch via title context", () => {
    expect(
      evaluateMarketplaceCategorySupport("newegg", "Watches", {
        title: "Apple Watch Series 9 Smartwatch",
      }).supported
    ).toBe(true);
    expect(
      evaluateMarketplaceCategorySupport("newegg", "Electronics").supported
    ).toBe(true);
  });

  it("allows all marketplaces when category is unknown", () => {
    expect(isUnknownProductCategory("")).toBe(true);
    const result = evaluateMarketplaceCategorySupport("stockx", "");
    expect(result.supported).toBe(true);
    expect(result.unknownCategory).toBe(true);
  });

  it("filterSupportedMarketplaces removes incompatible ids", () => {
    const filtered = filterSupportedMarketplaces(
      ["ebay", "stockx", "etsy", "wayfair"],
      "Watches"
    );
    expect(filtered).toEqual(["ebay", "etsy"]);
  });

  it("assertMarketplacesSupportCategory throws with expected message", () => {
    expect(() =>
      assertMarketplacesSupportCategory(["stockx"], "Watches")
    ).toThrow("Marketplace Stockx does not support category Watches");
  });

  it("exports unknown category warning", () => {
    expect(UNKNOWN_CATEGORY_WARNING).toContain("Unknown category");
  });
});
