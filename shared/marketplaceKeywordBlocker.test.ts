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

  it("blocks StockX for explicit blocked keywords in title", () => {
    const result = checkMarketplaceRestrictions("stockx", "Accessories", {
      title: "Rolex Submariner Watch",
    });
    expect(result.supported).toBe(false);
    expect(result.matchedBlockedKeywords).toContain("rolex");
  });

  it("blocks StockX for watch listings", () => {
    expect(
      isKeywordBlocked("stockx", "Watches", {
        title: "Rolex Submariner Watch",
        description: "Luxury dive watch",
      })
    ).toBe(true);

    const message = getMarketplaceRestrictionMessage("stockx", "Watches", {
      title: "Rolex Watch",
    });
    expect(message).toContain("Not supported");
  });

  it("allows StockX for sneaker listings", () => {
    const result = checkMarketplaceRestrictions("stockx", "Sneakers", {
      title: "Nike Air Jordan 1",
    });
    expect(result.supported).toBe(true);
  });

  it("filterAllowedMarketplaces removes blocked marketplaces", () => {
    const filtered = filterAllowedMarketplaces(
      ["ebay", "stockx", "poshmark", "wayfair"],
      "Watches",
      { title: "Vintage Watch" }
    );
    expect(filtered).toContain("ebay");
    expect(filtered).toContain("poshmark");
    expect(filtered).not.toContain("stockx");
    expect(filtered).not.toContain("wayfair");
  });
});
