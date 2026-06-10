import { describe, expect, it } from "vitest";
import { parseVisionResponse } from "./visionService";

describe("parseVisionResponse", () => {
  it("discards Invicta hallucination for luxury model title", () => {
    const raw = JSON.stringify({
      title: "Rolex Submariner Automatic",
      brand: "Invicta",
      brand_confidence: "high",
      model: "Pro Diver",
      category: "Watches",
      condition: "Used Rolex",
      price: 180,
      confidence: "high",
      description: "Diver watch",
    });

    const { product, hallucinationFlags } = parseVisionResponse(raw);
    expect(product?.brand).toBe("");
    expect(product?.brandConfidence).toBe("low");
    expect(product?.condition).toBe("Used");
    expect(hallucinationFlags.length).toBeGreaterThan(0);
  });

  it("preserves high-confidence Rolex when consistent", () => {
    const raw = JSON.stringify({
      title: "Rolex Submariner Date",
      brand: "Rolex",
      brand_confidence: "high",
      model: "Submariner",
      category: "Watches",
      condition: "Used",
      price: null,
      confidence: "high",
    });

    const { product } = parseVisionResponse(raw);
    expect(product?.brand).toBe("Rolex");
    expect(product?.brandConfidence).toBe("high");
    expect(product?.condition).toBe("Used");
  });
});
