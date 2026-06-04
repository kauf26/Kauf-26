import { extractReferenceNumbers, significantTokens } from "./visionMatch";

/**
 * Search queries derived only from vision title + brand (no product allowlists).
 */

export function buildExactMarketplaceQuery(
  visionTitle: string,
  visionBrand?: string
): string {
  const title = visionTitle.trim();
  const brand = visionBrand?.trim() ?? "";
  if (!title) return brand;
  if (brand && !title.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${title}`.trim();
  }
  return title;
}

export function buildBroadMarketplaceQuery(
  visionTitle: string,
  visionBrand?: string
): string {
  const title = visionTitle.trim();
  const brand = visionBrand?.trim() ?? "";
  const refs = extractReferenceNumbers(title);
  const tokens = significantTokens(title, brand);

  if (brand && refs[0]) {
    return `${brand} ${refs[0]}`.trim();
  }

  if (brand && tokens.length > 0) {
    return `${brand} ${tokens.slice(0, 4).join(" ")}`.trim();
  }

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 6) {
    return words.slice(0, 6).join(" ");
  }
  return title;
}

/** @deprecated Use buildExactMarketplaceQuery */
export function buildMarketplaceQuery(
  visionTitle: string,
  visionBrand?: string
): string {
  return buildExactMarketplaceQuery(visionTitle, visionBrand);
}
