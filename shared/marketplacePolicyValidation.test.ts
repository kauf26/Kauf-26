import { describe, it, expect, vi } from "vitest";
import {
  validatePreListingPolicy,
  validatePreListingPolicies,
  logPreListingPolicyWarnings,
} from "./marketplacePolicyValidation";
import {
  assertMarketplacesSupportCategory,
  evaluateMarketplaceCategorySupport,
  filterSupportedMarketplaces,
  isUnknownProductCategory,
  UNKNOWN_CATEGORY_WARNING,
} from "./marketplaceCategorySupport";

describe("marketplacePolicyValidation — Poshmark watches", () => {
  it("allows watches on Poshmark", () => {
    const result = validatePreListingPolicy("poshmark", "Watches");
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("allows apple watch via title context", () => {
    const result = validatePreListingPolicy("poshmark", "Accessories", {
      title: "Apple Watch Series 9",
    });
    expect(result.allowed).toBe(true);
  });

  it("warns on high-value watches ($500+) without blocking", () => {
    const result = validatePreListingPolicy("poshmark", "Watches", {
      priceUsd: 500,
    });
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].ruleId).toBe("poshmark-high-value-watch");
    expect(result.warnings[0].message).toContain("authentication process");
    expect(result.warnings[0].message).toContain("$500");
  });

  it("does not warn below $500", () => {
    const result = validatePreListingPolicy("poshmark", "Watches", {
      priceUsd: 499.99,
    });
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("logs warnings for review without rejecting publish", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { warnings } = validatePreListingPolicies(["poshmark"], "Watches", {
      priceUsd: 750,
    });
    logPreListingPolicyWarnings(warnings);
    expect(warnings).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PreListingPolicy]")
    );
    warnSpy.mockRestore();
  });
});

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

  it("allows Poshmark for watches", () => {
    const result = evaluateMarketplaceCategorySupport("poshmark", "Watches");
    expect(result.supported).toBe(true);
  });

  it("blocks restricted marketplaces for watches (except Poshmark)", () => {
    for (const id of ["stockx", "wayfair", "newegg"]) {
      const result = evaluateMarketplaceCategorySupport(id, "Watches");
      expect(result.supported).toBe(false);
      expect(result.disabledReason).toContain("Watches");
    }
  });

  it("surfaces Poshmark high-value watch warning in category support", () => {
    const result = evaluateMarketplaceCategorySupport("poshmark", "Watches", {
      priceUsd: 600,
    });
    expect(result.supported).toBe(true);
    expect(result.warnings?.[0]).toContain("$500");
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

  it("filterSupportedMarketplaces includes Poshmark for watches", () => {
    const filtered = filterSupportedMarketplaces(
      ["ebay", "stockx", "etsy", "poshmark", "wayfair"],
      "Watches"
    );
    expect(filtered).toEqual(["ebay", "etsy", "poshmark"]);
  });

  it("assertMarketplacesSupportCategory throws for hard blocks only", () => {
    expect(() =>
      assertMarketplacesSupportCategory(["stockx"], "Watches")
    ).toThrow("Marketplace Stockx does not support category Watches");

    expect(() =>
      assertMarketplacesSupportCategory(["poshmark"], "Watches", {
        priceUsd: 900,
      })
    ).not.toThrow();
  });

  it("exports unknown category warning", () => {
    expect(UNKNOWN_CATEGORY_WARNING).toContain("Unknown category");
  });
});
