import { describe, expect, it } from "vitest";
import { countUniqueDraftIds, dedupeDraftRowsById } from "./draftCount";

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
