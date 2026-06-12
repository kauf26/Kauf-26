import { describe, it, expect } from "vitest";
import {
  getBlockReason,
  filterAllowedMarketplacesForDraft,
  listingDraftFromFields,
} from "./marketplaceListingRules";

describe("marketplaceListingRules", () => {
  it("allows shopify listings with no rules defined", () => {
    expect(
      getBlockReason(
        "shopify",
        listingDraftFromFields({ title: "Anything goes", price: 9999 })
      )
    ).toBeNull();
  });

  it("blocks StockX for luxury watches", () => {
    const reason = getBlockReason(
      "stockx",
      listingDraftFromFields({
        title: "Rolex Submariner Watch",
        category: "Accessories",
      })
    );
    expect(reason).toContain("does not allow");
  });

  it("allows StockX for sneakers", () => {
    expect(
      getBlockReason(
        "stockx",
        listingDraftFromFields({
          title: "Nike Air Jordan 1",
          category: "Sneakers",
        })
      )
    ).toBeNull();
  });

  it("allows StockX for Apple Watch smartwatch exception", () => {
    expect(
      getBlockReason(
        "stockx",
        listingDraftFromFields({
          title: "Apple Watch Series 9",
          category: "Electronics",
        })
      )
    ).toBeNull();
  });

  it("blocks Depop luxury watches over $500", () => {
    const reason = getBlockReason(
      "depop",
      listingDraftFromFields({
        title: "Rolex Datejust",
        category: "Watches",
        price: 650,
      })
    );
    expect(reason).toContain("luxury watches over $500");
  });

  it("blocks Depop cars", () => {
    const reason = getBlockReason(
      "depop",
      listingDraftFromFields({
        title: "2018 Honda Civic",
        category: "Cars",
      })
    );
    expect(reason).toContain("not allowed");
  });

  it("blocks Depop electronics unless vintage", () => {
    const reason = getBlockReason(
      "depop",
      listingDraftFromFields({
        title: "iPhone 14 Pro",
        description: "Like new smartphone",
        category: "Electronics",
      })
    );
    expect(reason).toContain("vintage");
  });

  it("blocks Poshmark luxury watches over $500", () => {
    const reason = getBlockReason(
      "poshmark",
      listingDraftFromFields({
        title: "Omega Seamaster",
        price: 750,
      })
    );
    expect(reason).toContain("over $500");
  });

  it("filterAllowedMarketplacesForDraft removes blocked channels", () => {
    const draft = listingDraftFromFields({
      title: "Vintage Watch",
      category: "Watches",
    });
    const filtered = filterAllowedMarketplacesForDraft(
      ["ebay", "stockx", "poshmark"],
      draft
    );
    expect(filtered).toContain("ebay");
    expect(filtered).not.toContain("stockx");
  });
});
