import { describe, expect, it } from "vitest";
import {
  buildScraperSearchQuery,
  formatSourceLabels,
  mergeVisionResults,
  summarizeFieldVotes,
  type VisionPerImage,
} from "./visionMerge";

describe("mergeVisionResults", () => {
  it("picks highest-confidence title and merges colors", () => {
    const perImage: VisionPerImage[] = [
      {
        imageIndex: 0,
        title: "Rolex Submariner",
        brand: "Rolex",
        category: "Watches",
        color: "black",
        material: "steel",
        style: "",
        description: "Front dial view.",
        condition: "Used",
        confidence: "high",
      },
      {
        imageIndex: 1,
        title: "Submariner watch",
        brand: "Rolex",
        category: "Watches",
        color: "white",
        material: "",
        style: "diver",
        description: "Case back serial visible.",
        condition: "Used",
        confidence: "medium",
      },
      {
        imageIndex: 2,
        title: "Rolex",
        brand: "",
        category: "Accessories",
        color: "red logo",
        material: "steel",
        style: "",
        description: "Red crown logo on clasp.",
        condition: "Like New",
        confidence: "low",
      },
    ];

    const { vision, sources } = mergeVisionResults(perImage);

    expect(vision.title).toBe("Rolex Submariner");
    expect(vision.brand).toBe("Rolex");
    expect(vision.category).toBe("Watches");
    expect(vision.color).toBe("black");
    expect(vision.material).toBe("steel");
    expect(vision.description).toContain("Front dial view.");
    expect(vision.description).toContain("Case back serial visible.");
    expect(sources.title).toBe("image 1");
    expect(sources.color).toMatch(/image/);
  });

  it("formats multi-image source labels", () => {
    expect(formatSourceLabels([0, 1])).toBe("image 1 and image 2");
    expect(formatSourceLabels([0, 1, 2])).toBe("image 1, image 2, and image 3");
  });

  it("majority-votes brand and picks title matching aggregated brand", () => {
    const perImage: VisionPerImage[] = [
      {
        imageIndex: 0,
        title: "Aeropilot chronograph watch",
        brand: "Aeropilot",
        model: "Chronograph",
        category: "Watches",
        confidence: "medium",
      },
      {
        imageIndex: 1,
        title: "Breitling Chronospace",
        brand: "Breitling",
        model: "Chronospace",
        category: "Watches",
        confidence: "high",
      },
      {
        imageIndex: 2,
        title: "Breitling Chronospace Automatic",
        brand: "Breitling",
        model: "Chronospace",
        category: "Watches",
        confidence: "high",
      },
    ];

    const brandVotes = summarizeFieldVotes(perImage, "brand");
    expect(brandVotes.Breitling).toBe(2);
    expect(brandVotes.Aeropilot).toBe(1);

    const { vision } = mergeVisionResults(perImage);
    expect(vision.brand).toBe("Breitling");
    expect(vision.model).toBe("Chronospace");
    expect(vision.title).toBe("Breitling Chronospace Automatic");
    expect(buildScraperSearchQuery(vision)).toBe(
      "Breitling Chronospace Automatic"
    );
  });
});
