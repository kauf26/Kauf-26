import { describe, it, expect } from "vitest";
import {
  aggregateListings,
  coalesceBrandWithTitle,
  type RawListing,
} from "./listingUtils";

describe("coalesceBrandWithTitle", () => {
  it("uses Citizen from title when listing brand is Breitling", () => {
    const result = coalesceBrandWithTitle(
      "Citizen Eco-Drive Promaster Nighthawk",
      "Breitling",
      "Breitling"
    );
    expect(result.brand).toBe("Citizen");
    expect(result.corrected).toBe(true);
  });

  it("keeps vision brand when title mentions it", () => {
    const result = coalesceBrandWithTitle(
      "Breitling Navitimer B01",
      "",
      "Breitling"
    );
    expect(result.brand).toBe("Breitling");
  });

  it("uses Breitling when model-first title would parse Chronospace as brand", () => {
    const result = coalesceBrandWithTitle(
      "Chronospace Automatic Chronograph",
      "Breitling",
      "Breitling",
      { visionModel: "Chronospace" }
    );
    expect(result.brand).toBe("Breitling");
    expect(result.source).toBe("vision.model_not_brand");
    expect(result.corrected).toBe(true);
  });
});

describe("aggregateListings", () => {
  it("parses brand from title instead of falling back to vision brand", () => {
    const items: RawListing[] = [
      {
        title: "Citizen Eco-Drive Promaster Nighthawk",
        price: 250,
        url: "https://ebay.com/itm/123",
      },
    ];

    const result = aggregateListings(
      items,
      "Citizen Eco-Drive Promaster Nighthawk",
      {
        visionTitle: "Breitling watch",
        visionBrand: "Breitling",
      }
    );

    expect(result?.title).toContain("Citizen");
    expect(result?.brand).toBe("Citizen");
  });

  it("keeps brand aligned with rep title when both are present", () => {
    const items: RawListing[] = [
      {
        title: "Citizen Eco-Drive Promaster Nighthawk",
        brand: "Citizen",
        price: 250,
        url: "https://ebay.com/itm/123",
      },
    ];

    const result = aggregateListings(
      items,
      "Citizen Eco-Drive Promaster Nighthawk",
      {
        visionTitle: "Breitling watch",
        visionBrand: "Breitling",
      }
    );

    expect(result?.brand).toBe("Citizen");
    expect(result?.brandTitleCorrected).toBe(false);
  });
});
