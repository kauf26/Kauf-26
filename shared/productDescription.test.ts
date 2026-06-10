import { describe, it, expect } from "vitest";
import {
  AUTO_DESCRIPTION_DISCLAIMER,
  LISTING_LIABILITY_DISCLAIMER,
  buildAutoProductDescription,
  formatScrapedMarketAverage,
  isPlaceholderOrEmptyDescription,
  listingDescriptionFields,
  resolveProductDescription,
} from "./productDescription";

describe("productDescription", () => {
  it("exports disclaimer text", () => {
    expect(AUTO_DESCRIPTION_DISCLAIMER).toContain("Auto-generated description");
  });

  it("buildAutoProductDescription concatenates attributes", () => {
    const text = buildAutoProductDescription({
      brand: "Rolex",
      modelNumber: "Submariner 116610",
      color: "black/silver",
      material: "stainless steel",
      condition: "Used",
    });
    expect(text).toContain("Brand: Rolex");
    expect(text).toContain("Model: Submariner 116610");
    expect(text).toContain("Color: black/silver");
    expect(text).toContain("Material: stainless steel");
    expect(text).toContain("Auto-generated – please review and edit for accuracy.");
  });

  it("formatScrapedMarketAverage formats or shows Not available", () => {
    expect(formatScrapedMarketAverage("12.5")).toBe("$12.50");
    expect(formatScrapedMarketAverage("0")).toBe("Not available");
  });

  it("listingDescriptionFields merges draft and extras", () => {
    const fields = listingDescriptionFields(
      {
        brand: "Rolex",
        condition: "Used",
        material: "steel",
        product: { color: "black" },
      },
      { modelNumber: "116610" }
    );
    expect(fields.brand).toBe("Rolex");
    expect(fields.modelNumber).toBe("116610");
    expect(fields.color).toBe("black");
  });

  it("LISTING_LIABILITY_DISCLAIMER is defined", () => {
    expect(LISTING_LIABILITY_DISCLAIMER).toContain("your responsibility");
  });

  it("resolveProductDescription keeps non-empty scrape text", () => {
    expect(
      resolveProductDescription("Custom seller notes.", {
        brand: "Rolex",
      })
    ).toBe("Custom seller notes.");
  });

  it("resolveProductDescription auto-fills when blank", () => {
    expect(
      resolveProductDescription("", {
        brand: "Nike",
        modelNumber: "Air Max 90",
        color: "white",
      })
    ).toContain("Brand: Nike");
  });

  it("isPlaceholderOrEmptyDescription detects defaults", () => {
    expect(isPlaceholderOrEmptyDescription("")).toBe(true);
    expect(
      isPlaceholderOrEmptyDescription("Detailed product description goes here...")
    ).toBe(true);
    expect(isPlaceholderOrEmptyDescription("Vintage watch with box.")).toBe(false);
  });
});
