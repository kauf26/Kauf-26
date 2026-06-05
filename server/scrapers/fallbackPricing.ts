/**
 * Category-based default price ranges when no marketplace product is found.
 */

export type FallbackPriceRange = {
  min: number;
  max: number;
  suggested: number;
  requiresManualReview: true;
};

export function getFallbackPriceRange(
  category: string | undefined,
  title: string
): FallbackPriceRange {
  const cat = String(category ?? "").toLowerCase();
  const t = String(title ?? "").toLowerCase();

  if (
    cat.includes("clothing") ||
    /\b(cap|hat|trucker|snapback|beanie|shirt|tee|hoodie|jacket)\b/.test(t)
  ) {
    return { min: 15, max: 50, suggested: 28, requiresManualReview: true };
  }
  if (cat.includes("watch") || /\bwatch|chronograph\b/.test(t)) {
    return { min: 75, max: 500, suggested: 180, requiresManualReview: true };
  }
  if (cat.includes("electronic") || /\bphone|tablet|laptop|camera\b/.test(t)) {
    return { min: 50, max: 400, suggested: 120, requiresManualReview: true };
  }
  if (cat.includes("home") || /\bmug|cup|plate|bowl|kitchen\b/.test(t)) {
    return { min: 8, max: 45, suggested: 18, requiresManualReview: true };
  }
  if (cat.includes("toy") || /\btoy|game|figure\b/.test(t)) {
    return { min: 10, max: 60, suggested: 22, requiresManualReview: true };
  }

  return { min: 15, max: 75, suggested: 35, requiresManualReview: true };
}
