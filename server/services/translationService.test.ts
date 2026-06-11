import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  resolveTranslationTargetLanguage,
  translateText,
  getMarketplaceListingLanguage,
} from "./translationService";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("translationService", () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
  });

  it("resolves regional marketplace language", () => {
    expect(getMarketplaceListingLanguage("ebay_fr")).toBe("fr");
    expect(getMarketplaceListingLanguage("ebay_es")).toBe("es");
    expect(getMarketplaceListingLanguage("allegro")).toBe("pl");
  });

  it("picks first non-English marketplace language", () => {
    expect(
      resolveTranslationTargetLanguage({
        marketplaceIds: ["ebay", "allegro"],
      })
    ).toBe("pl");
  });

  it("honors explicit targetLang override", () => {
    expect(
      resolveTranslationTargetLanguage({
        marketplaceIds: ["ebay"],
        targetLang: "fr",
      })
    ).toBe("fr");
  });

  it("calls LibreTranslate /translate API", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { translatedText: "Reloj de buceo" },
    });

    const result = await translateText({
      text: "Diver watch",
      targetLang: "es",
      sourceLang: "en",
    });

    expect(result.translatedText).toBe("Reloj de buceo");
    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:5000/translate",
      expect.objectContaining({
        q: "Diver watch",
        target: "es",
        source: "en",
      }),
      expect.any(Object)
    );
  });
});
