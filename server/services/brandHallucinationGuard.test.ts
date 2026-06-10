import { describe, expect, it } from "vitest";
import { auditVisionBrandHallucination } from "./brandHallucinationGuard";

describe("auditVisionBrandHallucination", () => {
  it("clears Invicta brand when title implies luxury model", () => {
    const result = auditVisionBrandHallucination({
      title: "Rolex Submariner Automatic Diver",
      brand: "Invicta",
      brandConfidence: "high",
      confidence: "high",
      category: "Watches",
      price: 180,
    });
    expect(result.brand).toBe("");
    expect(result.brandConfidence).toBe("low");
    expect(result.hallucinationFlags).toContain(
      "budget_brand_with_luxury_model_name"
    );
  });

  it("keeps Rolex when title and brand align", () => {
    const result = auditVisionBrandHallucination({
      title: "Rolex Submariner Date",
      brand: "Rolex",
      brandConfidence: "high",
      confidence: "high",
      category: "Watches",
    });
    expect(result.brand).toBe("Rolex");
    expect(result.brandConfidence).toBe("high");
  });
});
