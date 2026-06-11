import axios from "axios";
import {
  getMarketplaceLocale,
  type MarketplaceLocale,
} from "../marketplaceMeta";
import type { VisionProduct } from "../visionMerge";

export const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL ?? "http://localhost:5000";

const TRANSLATE_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS ?? 15_000);

/** Regional marketplace IDs → target listing language (e.g. eBay country sites). */
const REGIONAL_MARKETPLACE_LANG: Record<string, string> = {
  ebay_es: "es",
  ebay_fr: "fr",
  ebay_de: "de",
  ebay_it: "it",
  ebay_nl: "nl",
  ebay_pl: "pl",
};

export type TranslateTextInput = {
  text: string;
  targetLang: string;
  sourceLang?: string;
};

export type TranslateTextResult = {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
};

export type VisionTranslationResult = {
  vision: VisionProduct;
  applied: boolean;
  targetLang: string | null;
  originalTitle: string;
  originalDescription: string;
  translatedTitle?: string;
  translatedDescription?: string;
  error?: string;
};

function normalizeLang(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
}

export function getMarketplaceListingLanguage(
  marketplaceId: string | null | undefined
): string {
  const id = String(marketplaceId ?? "")
    .trim()
    .toLowerCase();
  if (!id) return "en";
  if (REGIONAL_MARKETPLACE_LANG[id]) return REGIONAL_MARKETPLACE_LANG[id];
  return getMarketplaceLocale(id).lang;
}

/** Pick target language from explicit override or first selected marketplace. */
export function resolveTranslationTargetLanguage(input: {
  marketplaceIds?: string[];
  targetLang?: string | null;
}): string | null {
  const explicit = normalizeLang(input.targetLang);
  if (explicit) return explicit;

  const ids = (input.marketplaceIds ?? [])
    .map((id) => String(id).trim().toLowerCase())
    .filter(Boolean);
  if (ids.length === 0) return null;

  for (const id of ids) {
    const lang = getMarketplaceListingLanguage(id);
    if (lang && lang !== "en") return lang;
  }

  return getMarketplaceListingLanguage(ids[0]);
}

export async function translateText(
  input: TranslateTextInput
): Promise<TranslateTextResult> {
  const text = String(input.text ?? "").trim();
  const targetLang = normalizeLang(input.targetLang);
  const sourceLang = normalizeLang(input.sourceLang) || "auto";

  if (!text) {
    return { translatedText: "", sourceLang, targetLang };
  }
  if (targetLang === sourceLang && sourceLang !== "auto") {
    return { translatedText: text, sourceLang, targetLang };
  }

  const response = await axios.post<{ translatedText?: string }>(
    `${LIBRETRANSLATE_URL.replace(/\/$/, "")}/translate`,
    {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: "text",
    },
    { timeout: TRANSLATE_TIMEOUT_MS }
  );

  const translatedText = String(response.data?.translatedText ?? "").trim();
  return {
    translatedText: translatedText || text,
    sourceLang,
    targetLang,
  };
}

export async function checkTranslationServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(
      `${LIBRETRANSLATE_URL.replace(/\/$/, "")}/languages`,
      { timeout: 5000 }
    );
    return Array.isArray(response.data);
  } catch {
    return false;
  }
}

export async function translateVisionListingFields(
  vision: VisionProduct,
  options: {
    targetLang: string;
    sourceLang?: string;
  }
): Promise<VisionTranslationResult> {
  const originalTitle = String(vision.title ?? "").trim();
  const originalDescription = String(vision.description ?? "").trim();
  const targetLang = normalizeLang(options.targetLang);

  if (!targetLang || targetLang === "en" || (!originalTitle && !originalDescription)) {
    return {
      vision,
      applied: false,
      targetLang: targetLang || null,
      originalTitle,
      originalDescription,
    };
  }

  try {
    const [titleResult, descriptionResult] = await Promise.all([
      originalTitle
        ? translateText({
            text: originalTitle,
            targetLang,
            sourceLang: options.sourceLang,
          })
        : Promise.resolve({
            translatedText: "",
            sourceLang: options.sourceLang ?? "auto",
            targetLang,
          }),
      originalDescription
        ? translateText({
            text: originalDescription,
            targetLang,
            sourceLang: options.sourceLang,
          })
        : Promise.resolve({
            translatedText: "",
            sourceLang: options.sourceLang ?? "auto",
            targetLang,
          }),
    ]);

    const translatedTitle = titleResult.translatedText || originalTitle;
    const translatedDescription =
      descriptionResult.translatedText || originalDescription;

    return {
      vision: {
        ...vision,
        title: translatedTitle,
        description: translatedDescription,
      },
      applied: true,
      targetLang,
      originalTitle,
      originalDescription,
      translatedTitle,
      translatedDescription,
    };
  } catch (error) {
    return {
      vision,
      applied: false,
      targetLang,
      originalTitle,
      originalDescription,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function marketplaceLocalesForIds(
  marketplaceIds: string[]
): MarketplaceLocale[] {
  return marketplaceIds.map((id) => getMarketplaceLocale(id));
}

/** Whether the identify pipeline should call LibreTranslate. */
export function shouldRunListingTranslation(input: {
  autoTranslate?: boolean;
  marketplaceIds?: string[];
  targetLang?: string | null;
}): boolean {
  if (input.autoTranslate === false) return false;
  if (input.autoTranslate === true) return true;
  const target = resolveTranslationTargetLanguage({
    marketplaceIds: input.marketplaceIds,
    targetLang: input.targetLang,
  });
  return Boolean(target && target !== "en" && (input.marketplaceIds?.length ?? 0) > 0);
}

export type ListingTranslationResult = {
  applied: boolean;
  targetLang: string | null;
  originalTitle: string;
  originalDescription: string;
  translatedTitle?: string;
  translatedDescription?: string;
  error?: string;
};

/** Translate final listing title + description via LibreTranslate. */
export async function translateListingTextFields(
  listing: { title?: string; description?: string; longDescription?: string },
  options: { targetLang: string; sourceLang?: string }
): Promise<ListingTranslationResult & { listing: typeof listing }> {
  const originalTitle = String(listing.title ?? "").trim();
  const originalDescription = String(
    listing.description ?? listing.longDescription ?? ""
  ).trim();
  const targetLang = normalizeLang(options.targetLang);

  if (!targetLang || targetLang === "en" || (!originalTitle && !originalDescription)) {
    return {
      listing,
      applied: false,
      targetLang: targetLang || null,
      originalTitle,
      originalDescription,
    };
  }

  try {
    const [titleResult, descriptionResult] = await Promise.all([
      originalTitle
        ? translateText({
            text: originalTitle,
            targetLang,
            sourceLang: options.sourceLang,
          })
        : Promise.resolve({
            translatedText: "",
            sourceLang: options.sourceLang ?? "auto",
            targetLang,
          }),
      originalDescription
        ? translateText({
            text: originalDescription,
            targetLang,
            sourceLang: options.sourceLang,
          })
        : Promise.resolve({
            translatedText: "",
            sourceLang: options.sourceLang ?? "auto",
            targetLang,
          }),
    ]);

    const translatedTitle = titleResult.translatedText || originalTitle;
    const translatedDescription =
      descriptionResult.translatedText || originalDescription;

    return {
      listing: {
        ...listing,
        title: translatedTitle,
        description: translatedDescription,
        longDescription: translatedDescription || listing.longDescription,
      },
      applied: true,
      targetLang,
      originalTitle,
      originalDescription,
      translatedTitle,
      translatedDescription,
    };
  } catch (error) {
    return {
      listing,
      applied: false,
      targetLang,
      originalTitle,
      originalDescription,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
