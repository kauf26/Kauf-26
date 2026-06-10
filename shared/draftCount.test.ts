import { describe, expect, it } from "vitest";
import {
  countUniqueDraftIds,
  countUniqueProductDrafts,
  dedupeDraftRowsById,
  productDraftFingerprint,
} from "./draftCount";

describe("countUniqueProductDrafts", () => {
  it("counts one product with many photos on a single draft row", () => {
    const drafts = [
      {
        id: 1,
        title: "Rolex Submariner",
        attributes: { brand: "Rolex" },
        images: ["a", "b", "c", "d", "e"],
      },
    ];
    expect(countUniqueProductDrafts(drafts)).toBe(1);
  });

  it("dedupes repeated identify saves for the same product", () => {
    const drafts = [
      { id: 1, title: "Rolex Submariner Watch", attributes: { brand: "Rolex" } },
      { id: 2, title: "Rolex Submariner Watch", attributes: { brand: "Rolex" } },
      { id: 3, title: "Omega Speedmaster", attributes: { brand: "Omega" } },
    ];
    expect(countUniqueProductDrafts(drafts)).toBe(2);
  });

  it("uses stable sku when not auto-generated", () => {
    expect(
      productDraftFingerprint({ id: 1, title: "A", sku: "SKU-100", attributes: {} })
    ).toBe("sku:sku-100");
    expect(
      productDraftFingerprint({ id: 2, title: "B", sku: "AUTO-123", attributes: {} })
    ).toBe("t:b");
  });
});

describe("countUniqueDraftIds", () => {
  it("counts distinct draft ids only", () => {
    const drafts = [
      { id: 1, images: ["a", "b", "c"] },
      { id: 1, images: ["d"] },
      { id: 2, images: ["e"] },
      { id: "3" },
    ];
    expect(countUniqueDraftIds(drafts)).toBe(3);
    expect(dedupeDraftRowsById(drafts)).toHaveLength(3);
  });

  it("ignores rows without valid ids", () => {
    expect(countUniqueDraftIds([{ id: null }, { id: "x" }])).toBe(0);
  });
});
