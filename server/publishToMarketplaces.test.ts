import { describe, it, expect } from "vitest";
import { draftToPublishPayload } from "./publishToMarketplaces";

describe("draftToPublishPayload", () => {
  it("collects images from attributes when draft.images is empty", () => {
    const img = "data:image/jpeg;base64,xyz";
    const payload = draftToPublishPayload({
      id: 10,
      title: "Breitling",
      images: [],
      attributes: {
        capturedImage: img,
        recommendedPrice: 1000,
      },
    });

    expect(payload.images).toEqual([img]);
    expect(payload.attributes.recommendedPrice).toBe(1000);
  });

  it("preserves images array from identify save", () => {
    const imgs = [
      "data:image/jpeg;base64,1",
      "data:image/jpeg;base64,2",
    ];
    const payload = draftToPublishPayload({
      id: 11,
      title: "Breitling",
      images: imgs,
      attributes: {
        recommendedPrice: "1000.00",
        marketPrices: { recommendedPrice: "1000.00" },
      },
    });

    expect(payload.images).toHaveLength(2);
  });
});
