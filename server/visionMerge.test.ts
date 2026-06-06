import { describe, expect, it } from "vitest";
import {
  formatSourceLabels,
  mergeVisionResults,
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
    expect(vision.color).toContain("black");
    expect(vision.color).toContain("white");
    expect(vision.color).toContain("red logo");
    expect(vision.description).toContain("Front dial view.");
    expect(vision.description).toContain("Case back serial visible.");
    expect(sources.title).toBe("image 1");
    expect(sources.color).toMatch(/image/);
  });

  it("formats multi-image source labels", () => {
    expect(formatSourceLabels([0, 1])).toBe("image 1 and image 2");
    expect(formatSourceLabels([0, 1, 2])).toBe("image 1, image 2, and image 3");
  });
});
