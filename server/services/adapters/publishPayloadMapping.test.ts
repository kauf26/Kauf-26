import { describe, it, expect } from "vitest";
import { draftToPublishPayload } from "../../publishToMarketplaces";
import { formatEbayListing } from "./ebayAdapter";
import { formatMercadoLibreListing } from "./mercadolibreAdapter";
import { formatPartnershipListing } from "./partnershipAdapter";
import { getAdapter } from "./index";

const sampleDbDraft = {
  id: 99,
  title: "Breitling Chronograph Watch",
  sku: "kauf26-99",
  images: [] as string[],
  attributes: {
    capturedImage: "data:image/jpeg;base64,abc",
    capturedImages: [
      "data:image/jpeg;base64,abc",
      "data:image/jpeg;base64,def",
    ],
    recommendedPrice: 1000,
    brand: "Breitling",
    condition: "Used",
    aiDescription: "A watch",
  },
};

describe("publish price/image mapping", () => {
  const payload = draftToPublishPayload(sampleDbDraft);

  it("collects images from attributes when draft.images is empty", () => {
    expect(payload.images.length).toBeGreaterThan(0);
  });

  it("ebay: price > 0 and imageCount > 0", () => {
    const formatted = formatEbayListing(payload);
    expect(Number((formatted.price as { value: string }).value)).toBeGreaterThan(
      0
    );
    expect(formatted.imageCount).toBeGreaterThan(0);
  });

  it("mercadolibre: price > 0 and imageCount > 0", () => {
    const formatted = formatMercadoLibreListing(payload);
    expect((formatted.apiBody as { price: number }).price).toBeGreaterThan(0);
    expect(formatted.imageCount).toBeGreaterThan(0);
  });

  it("partnership (mercari, stockx, whatnot): price > 0 and imageCount > 0", () => {
    for (const id of ["mercari", "stockx", "whatnot"] as const) {
      const formatted = formatPartnershipListing(payload, id, id);
      expect(formatted.price).toBeGreaterThan(0);
      expect(formatted.imageCount).toBeGreaterThan(0);
    }
  });

  it("pinterest: price > 0 and imageCount > 0", () => {
    const adapter = getAdapter("pinterest");
    expect(adapter).toBeDefined();
    const formatted = adapter!.format(payload);
    expect(formatted.price).toBeGreaterThan(0);
    expect(formatted.imageCount).toBeGreaterThan(0);
  });
});
