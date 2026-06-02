// src/lib/pendingAnalysis.ts

export const PENDING_ANALYSIS_KEY = "pendingAnalysis";

export type PendingAnalysis = {
  capturedImage: string;
  title: string;
  brand: string;
  description: string;
  price: string;
  category: string;
  condition: string;
  modelNumber: string;
  material: string;
  allegroAverage: string;
  ebayAverage: string;
  isExactMatch: boolean;
  year?: string | number;
  timestamp?: string;
};

/** * Normalizes incoming data from different sources (Camera API, Scraper, or Manual)
 * into a single consistent structure for the Draft page.
 */
export function toPendingAnalysis(input: Record<string, any>): PendingAnalysis {
  // Extract and normalize price
  const price = input.recommendedPrice ?? input.price ?? input.suggestedPrice ?? "0.00";
  
  return {
    capturedImage: String(input.capturedImage ?? input.imageUrl ?? ""),
    title: String(input.modelName ?? input.title ?? "Identified Item"),
    brand: String(input.brand ?? ""),
    description: String(input.aiDescription ?? input.description ?? ""),
    price: String(price),
    category: String(input.category ?? "Watches"),
    condition: String(input.condition ?? "New"),
    modelNumber: String(input.refNumber ?? input.modelNumber ?? ""),
    material: String(input.material ?? ""),
    allegroAverage: String(input.allegroAvg ?? input.allegroAverage ?? price),
    ebayAverage: String(input.ebayAvg ?? input.ebayAverage ?? price),
    isExactMatch: Boolean(input.isExactMatch ?? true),
    year: input.year,
    timestamp: new Date().toISOString(),
  };
}

export function savePendingAnalysis(input: Record<string, any>): void {
  sessionStorage.setItem(
    PENDING_ANALYSIS_KEY,
    JSON.stringify(toPendingAnalysis(input))
  );
}

export function loadPendingAnalysis(): PendingAnalysis | null {
  const raw = sessionStorage.getItem(PENDING_ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading pending analysis:", e);
    return null;
  }
}
