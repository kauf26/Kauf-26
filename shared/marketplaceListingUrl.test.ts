import { describe, expect, it } from "vitest";
import { buildMarketplaceListingUrl, truncateListingUrl } from "./marketplaceListingUrl";
import { resolvePublishedListingUrl } from "./publishedListings";

describe("buildMarketplaceListingUrl", () => {
  it("builds Etsy and eBay URLs", () => {
    expect(buildMarketplaceListingUrl("etsy", "12345")).toBe(
      "https://www.etsy.com/listing/12345"
    );
    expect(buildMarketplaceListingUrl("ebay", "987654321")).toBe(
      "https://www.ebay.com/itm/987654321"
    );
  });

  it("uses shop domain for Shopify", () => {
    expect(
      buildMarketplaceListingUrl("shopify", "gid-1", {
        shopDomain: "my-store.myshopify.com",
      })
    ).toBe("https://my-store.myshopify.com/products/gid-1");
  });

  it("returns null without listing id", () => {
    expect(buildMarketplaceListingUrl("etsy", "")).toBeNull();
  });
});

describe("resolvePublishedListingUrl", () => {
  it("prefers explicit listingUrl", () => {
    expect(
      resolvePublishedListingUrl({
        marketplace: "etsy",
        listingUrl: "https://example.com/custom",
        marketplaceListingId: "1",
      })
    ).toBe("https://example.com/custom");
  });

  it("falls back to ebayItemId", () => {
    expect(
      resolvePublishedListingUrl({
        marketplace: "ebay",
        ebayItemId: "555",
      })
    ).toBe("https://www.ebay.com/itm/555");
  });
});

describe("truncateListingUrl", () => {
  it("shortens long URLs", () => {
    const url = "https://www.etsy.com/listing/123456789012345678901234567890";
    expect(truncateListingUrl(url, 40).length).toBeLessThanOrEqual(40);
  });
});
