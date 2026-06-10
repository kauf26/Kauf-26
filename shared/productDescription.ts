export const AUTO_DESCRIPTION_DISCLAIMER =
  "⚠️ Auto-generated description – please review carefully. You are solely responsible for the accuracy of all listing information.";

export const LISTING_LIABILITY_DISCLAIMER =
  "⚠️ All listing information, including price, description, and images, is your responsibility. Please verify accuracy before publishing. We are not liable for errors in auto-generated content.";

export const PRICE_RESPONSIBILITY_HINT =
  "You are responsible for setting the final price.";

export type ProductDescriptionFields = {
  brand?: string;
  modelNumber?: string;
  color?: string;
  material?: string;
  materialComposition?: string;
  condition?: string;
  title?: string;
  existingDescription?: string;
};

const PLACEHOLDER_DESCRIPTIONS = [
  /^detailed product description goes here/i,
  /^description will be generated/i,
  /^enter product description/i,
  /^please review and edit this listing description for accuracy\.$/i,
];

export function isPlaceholderOrEmptyDescription(
  description: string | undefined | null
): boolean {
  const value = description?.trim() ?? "";
  if (!value) return true;
  return PLACEHOLDER_DESCRIPTIONS.some((pattern) => pattern.test(value));
}

/** Build a pipe-separated summary from product attributes. */
export function buildAutoProductDescription(
  fields: ProductDescriptionFields
): string {
  const segments: string[] = [];

  const brand = fields.brand?.trim();
  const model = fields.modelNumber?.trim();
  const color = fields.color?.trim();
  const material = (fields.materialComposition ?? fields.material)?.trim();
  const condition = fields.condition?.trim();

  if (brand) segments.push(`Brand: ${brand}`);
  if (model) segments.push(`Model: ${model}`);
  if (color) segments.push(`Color: ${color}`);
  if (material) segments.push(`Material: ${material}`);
  if (condition) segments.push(`Condition: ${condition}`);

  if (segments.length === 0 && fields.title?.trim()) {
    segments.push(`Item: ${fields.title.trim()}`);
  }

  if (segments.length === 0) {
    return "Auto-generated – please review and edit for accuracy.";
  }

  return `${segments.join(" | ")}. Auto-generated – please review and edit for accuracy.`;
}

/** Keep user/scrape text when present; otherwise synthesize from attributes. */
export function resolveProductDescription(
  existing: string | undefined | null,
  fields: ProductDescriptionFields
): string {
  if (!isPlaceholderOrEmptyDescription(existing)) {
    return String(existing).trim();
  }
  return buildAutoProductDescription(fields);
}

/** Format scraped marketplace average for display. */
export function formatScrapedMarketAverage(
  value: string | number | undefined | null
): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "Not available";
}

export type ListingDraftLike = {
  brand?: string;
  condition?: string;
  title?: string;
  description?: string;
  material?: string;
  color?: string;
  product?: {
    brand?: string;
    condition?: string;
    material?: string;
    color?: string;
    ebayAvg?: string;
    allegroAvg?: string;
  };
};

/** Build description field inputs from a listing session / draft object. */
export function listingDescriptionFields(
  draft: ListingDraftLike,
  extras?: { modelNumber?: string }
): ProductDescriptionFields {
  return {
    brand: draft.brand ?? draft.product?.brand,
    modelNumber: extras?.modelNumber,
    color: draft.color ?? draft.product?.color,
    material: draft.material ?? draft.product?.material,
    condition: draft.condition ?? draft.product?.condition,
    title: draft.title,
    existingDescription: draft.description,
  };
}
