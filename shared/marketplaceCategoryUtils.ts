/**
 * Shared category text matching helpers for marketplace policy validation.
 */

export const UNKNOWN_CATEGORY_WARNING =
  "Unknown category – verify marketplace suitability.";

export type CategoryContext = {
  title?: string;
  description?: string;
};

export function normalizeCategoryText(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isUnknownProductCategory(
  category: string | undefined | null
): boolean {
  const normalized = normalizeCategoryText(category);
  if (!normalized) return true;
  return (
    normalized === "not available" ||
    normalized === "unknown" ||
    normalized === "general" ||
    normalized === "n/a"
  );
}

export function buildCategoryMatchText(
  category: string | undefined | null,
  context?: CategoryContext
): string {
  const parts = [
    normalizeCategoryText(category),
    normalizeCategoryText(context?.title),
    normalizeCategoryText(context?.description),
  ].filter(Boolean);
  return parts.join(" ");
}

export function categoryMatchesKeywords(
  matchText: string,
  keywords: readonly string[]
): boolean {
  if (!matchText) return false;
  return keywords.some((keyword) => matchText.includes(keyword.toLowerCase()));
}
