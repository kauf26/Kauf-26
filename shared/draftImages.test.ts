import { describe, expect, it } from "vitest";
import {
  MAX_ADD_PHOTOS_PER_REQUEST,
  MAX_DRAFT_IMAGES,
  mergeUniqueDraftImageUrls,
  validateAddPhotosRequest,
} from "./draftImages";

describe("validateAddPhotosRequest", () => {
  it("rejects empty or oversized batches", () => {
    expect(validateAddPhotosRequest([], []).ok).toBe(false);
    expect(
      validateAddPhotosRequest(
        Array.from({ length: MAX_ADD_PHOTOS_PER_REQUEST + 1 }, () => "https://a.com/1.jpg"),
        []
      ).ok
    ).toBe(false);
  });

  it("rejects when total would exceed limit", () => {
    const existing = Array.from({ length: MAX_DRAFT_IMAGES }, (_, i) => `https://example.com/${i}.jpg`);
    const result = validateAddPhotosRequest(
      ["https://example.com/new.jpg"],
      existing
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicates already on draft", () => {
    const result = validateAddPhotosRequest(
      ["https://example.com/a.jpg"],
      ["https://example.com/a.jpg"]
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid urls", () => {
    const result = validateAddPhotosRequest(
      ["https://example.com/a.jpg", "/uploads/b.jpg"],
      ["https://example.com/1.jpg"]
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.imageUrls).toHaveLength(2);
    }
  });
});

describe("mergeUniqueDraftImageUrls", () => {
  it("dedupes and caps at max total", () => {
    const existing = ["https://example.com/1.jpg"];
    const incoming = [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      ...Array.from({ length: 12 }, (_, i) => `https://example.com/x${i}.jpg`),
    ];

    const { merged, added, duplicates } = mergeUniqueDraftImageUrls(
      existing,
      incoming,
      MAX_DRAFT_IMAGES
    );

    expect(merged).toHaveLength(MAX_DRAFT_IMAGES);
    expect(added.length).toBe(MAX_DRAFT_IMAGES - 1);
    expect(duplicates).toContain("https://example.com/1.jpg");
  });
});
