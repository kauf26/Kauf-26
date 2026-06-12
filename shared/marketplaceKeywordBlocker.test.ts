import { describe, it, expect } from "vitest";
import {
  checkMarketplaceRestrictions,
  filterAllowedMarketplaces,
  getBlockedKeywords,
  isKeywordBlocked,
  getMarketplaceRestrictionMessage,
} from "./marketplaceKeywordBlocker";

describe("marketplaceKeywordBlocker", () => {
  it("exports keyword policies for restricted marketplaces", () => {
    const policies = getBlockedKeywords();
    expect(policies.stockx?.allowedKeywords).toContain("sneaker");
    expect(policies.poshmark?.allowedKeywords).toContain("watch");
  });

  it("blocks StockX for non-footwear categories via whitelist", () => {
    const result = checkMarketplaceRestrictions("stockx", "Furniture", {
      title: "Oak Dining Table",
    });
    expect(result.supported).toBe(false);
  });

  it("allows StockX for sneaker listings", () => {
    const result = checkMarketplaceRestrictions("stockx", "Sneakers", {
      title: "Nike Air Jordan 1",
    });
    expect(result.supported).toBe(true);
  });

  it("filterAllowedMarketplaces removes category-incompatible marketplaces", () => {
    const filtered = filterAllowedMarketplaces(
      ["ebay", "stockx", "poshmark", "wayfair"],
      "Furniture",
      { title: "Oak Dining Table" }
    );
    expect(filtered).toContain("ebay");
    expect(filtered).toContain("wayfair");
    expect(filtered).not.toContain("stockx");
  });
});
