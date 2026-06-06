import { describe, it, expect, vi, afterEach } from "vitest";
import {
  collectDraftImages,
  draftPrice,
} from "./adapterUtils";
import type { DraftPublishPayload } from "../../publishToMarketplaces";

describe("draftPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers attributes.recommendedPrice", () => {
    const draft: DraftPublishPayload = {
      draftId: 1,
      title: "Watch",
      images: [],
      attributes: {
        recommendedPrice: 1500,
        medianPrice: "900",
        marketPrices: { recommendedPrice: "800" },
      },
    };
    expect(draftPrice(draft)).toBe(1500);
  });

  it("falls back through medianPrice and marketPrices.recommendedPrice", () => {
    expect(
      draftPrice({
        draftId: 2,
        title: "Watch",
        images: [],
        attributes: {
          medianPrice: "1200",
          marketPrices: { recommendedPrice: "800" },
        },
      })
    ).toBe(1200);

    expect(
      draftPrice({
        draftId: 3,
        title: "Watch",
        images: [],
        attributes: {
          marketPrices: { recommendedPrice: "999" },
        },
      })
    ).toBe(999);
  });

  it("uses attributes.price when higher-priority fields are missing", () => {
    expect(
      draftPrice({
        draftId: 4,
        title: "Watch",
        images: [],
        attributes: { price: "750" },
      })
    ).toBe(750);
  });

  it("logs warning and returns 0 when no price is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      draftPrice({
        draftId: 5,
        title: "Watch",
        images: [],
        attributes: {},
      })
    ).toBe(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("collectDraftImages", () => {
  it("merges draft.images, capturedImage, capturedImages, and page URLs", () => {
    const img1 = "data:image/jpeg;base64,aaa";
    const img2 = "data:image/jpeg;base64,bbb";
    const url = "https://example.com/product.jpg";

    const images = collectDraftImages({
      images: [img1],
      attributes: {
        capturedImage: img2,
        capturedImages: [img2],
        productPageImageUrls: [url],
      },
    });

    expect(images).toEqual([img1, img2, url]);
  });
});
