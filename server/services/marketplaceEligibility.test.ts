import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import {
  checkMarketplaceEligibility,
  filterEligibleMarketplaces,
  loadMarketplaceRulesFromFile,
  reloadMarketplaceRules,
} from "./marketplaceEligibility";

const RULES_PATH = path.resolve(process.cwd(), "config/marketplace-rules.json");

describe("marketplaceEligibility", () => {
  beforeEach(() => {
    reloadMarketplaceRules();
    loadMarketplaceRulesFromFile(RULES_PATH);
  });

  it("allows shopify listings with no restrictions", () => {
    const result = checkMarketplaceEligibility("shopify", {
      title: "Anything",
      price: 99999,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks Depop cars", () => {
    const result = checkMarketplaceEligibility("depop", {
      title: "2018 Honda Civic",
      category: "Cars",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("cars or vehicle parts");
  });

  it("blocks Depop luxury watches over $500", () => {
    const result = checkMarketplaceEligibility("depop", {
      title: "Rolex Datejust",
      category: "Watches",
      price: 650,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("500");
  });

  it("blocks StockX for rolex watch", () => {
    const result = checkMarketplaceEligibility("stockx", {
      title: "Rolex Submariner Watch",
      category: "Accessories",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not support watches");
  });

  it("allows StockX for Apple Watch exception", () => {
    const result = checkMarketplaceEligibility("stockx", {
      title: "Apple Watch Series 9",
      category: "Electronics",
    });
    expect(result.allowed).toBe(true);
  });

  it("filters ineligible marketplaces", () => {
    const filtered = filterEligibleMarketplaces(
      ["ebay", "stockx", "shopify"],
      { title: "Vintage Watch", category: "Watches" }
    );
    expect(filtered).toContain("ebay");
    expect(filtered).toContain("shopify");
    expect(filtered).not.toContain("stockx");
  });
});
