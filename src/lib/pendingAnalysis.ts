// src/lib/pendingAnalysis.ts

export const PENDING_ANALYSIS_KEY = "pendingAnalysis";
export const PRODUCT_LISTING_DATA_KEY = "productListingData";

export type MatchType = "exact" | "similar" | "generic";

function resolveMatchType(
  data: Record<string, unknown>,
  p: Record<string, unknown>
): MatchType {
  const raw = data.matchType ?? p.matchType;
  if (raw === "exact" || raw === "similar" || raw === "generic") {
    return raw;
  }
  if (data.isExactMatch === true || p.isExactMatch === true) return "exact";
  return "generic";
}

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
  matchType?: MatchType;
  year?: string | number;
  timestamp?: string;
};

/** Unified shape for draft + marketplace pages */
export type ListingSession = {
  product: {
    title: string;
    description: string;
    price: string;
    brand: string;
    category: string;
    condition: string;
    capturedImage: string;
    allegroAvg: string;
    ebayAvg: string;
    isExactMatch?: boolean;
    matchType?: MatchType;
  };
  title: string;
  description: string;
  price: string;
  brand: string;
  category: string;
  condition: string;
  capturedImage: string;
  isExactMatch?: boolean;
  matchType?: MatchType;
};

/** Normalize Task A `{ product }`, identify API, or legacy `productListingData` */
export function parseListingSession(raw: unknown): ListingSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const p = (data.product as Record<string, unknown>) ?? data;

  const title = String(p.title ?? data.modelName ?? "").trim();
  if (!title) return null;

  const description = String(
    p.description ?? data.aiDescription ?? data.description ?? ""
  ).trim();
  const price = String(p.price ?? data.recommendedPrice ?? "0");
  const product = {
    title,
    description,
    price,
    brand: String(p.brand ?? data.brand ?? ""),
    category: String(p.category ?? data.category ?? ""),
    condition: String(p.condition ?? data.condition ?? "Used"),
    capturedImage: String(p.capturedImage ?? data.capturedImage ?? ""),
    allegroAvg: String(
      p.allegroAvg ?? p.allegroAverage ?? data.allegroAvg ?? price
    ),
    ebayAvg: String(p.ebayAvg ?? p.ebayAverage ?? data.ebayAvg ?? price),
    isExactMatch: Boolean(data.isExactMatch ?? p.isExactMatch ?? false),
    matchType: resolveMatchType(data, p),
  };

  return {
    ...product,
    product,
    matchType: product.matchType,
  };
}

export function saveListingSession(session: ListingSession): void {
  sessionStorage.setItem(PENDING_ANALYSIS_KEY, JSON.stringify(session));
  sessionStorage.setItem(
    PRODUCT_LISTING_DATA_KEY,
    JSON.stringify({
      capturedImage: session.capturedImage,
      modelName: session.title,
      brand: session.brand,
      year: new Date().getFullYear(),
      condition: session.condition,
      category: session.category,
      refNumber: "",
      material: "",
      aiDescription: session.description,
      recommendedPrice: parseFloat(session.price) || 0,
      allegroAvg: parseFloat(session.product.allegroAvg) || 0,
      ebayAvg: parseFloat(session.product.ebayAvg) || 0,
    })
  );
}

export function loadListingSession(): ListingSession | null {
  for (const key of [PENDING_ANALYSIS_KEY, PRODUCT_LISTING_DATA_KEY]) {
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = parseListingSession(JSON.parse(raw));
      if (parsed) return parsed;
    } catch {
      /* try next key */
    }
  }
  return null;
}

/** @deprecated Prefer saveListingSession — kept for IdentificationResults */
export function toPendingAnalysis(input: Record<string, unknown>): PendingAnalysis {
  const listing = parseListingSession(input);
  if (listing) {
    return {
      capturedImage: listing.capturedImage,
      title: listing.title,
      brand: listing.brand,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      condition: listing.condition,
      modelNumber: String(input.refNumber ?? input.modelNumber ?? ""),
      material: String(input.material ?? ""),
      allegroAverage: listing.product.allegroAvg,
      ebayAverage: listing.product.ebayAvg,
      isExactMatch: listing.isExactMatch ?? false,
      matchType: listing.matchType,
      year: input.year as string | number | undefined,
      timestamp: new Date().toISOString(),
    };
  }
  const price = String(
    input.recommendedPrice ?? input.price ?? input.suggestedPrice ?? "0"
  );
  return {
    capturedImage: String(input.capturedImage ?? input.imageUrl ?? ""),
    title: String(input.modelName ?? input.title ?? "Identified Item"),
    brand: String(input.brand ?? ""),
    description: String(input.aiDescription ?? input.description ?? ""),
    price,
    category: String(input.category ?? ""),
    condition: String(input.condition ?? "Used"),
    modelNumber: String(input.refNumber ?? input.modelNumber ?? ""),
    material: String(input.material ?? ""),
    allegroAverage: String(input.allegroAvg ?? input.allegroAverage ?? price),
    ebayAverage: String(input.ebayAvg ?? input.ebayAverage ?? price),
    isExactMatch: Boolean(input.isExactMatch ?? false),
    year: input.year as string | number | undefined,
    timestamp: new Date().toISOString(),
  };
}

export function savePendingAnalysis(input: Record<string, unknown>): void {
  const listing = parseListingSession(input);
  if (listing) {
    saveListingSession(listing);
    return;
  }
  sessionStorage.setItem(
    PENDING_ANALYSIS_KEY,
    JSON.stringify(toPendingAnalysis(input))
  );
}

export function loadPendingAnalysis(): PendingAnalysis | null {
  const listing = loadListingSession();
  if (listing) {
    return toPendingAnalysis(listing as unknown as Record<string, unknown>);
  }
  const raw = sessionStorage.getItem(PENDING_ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAnalysis;
  } catch (e) {
    console.error("Error loading pending analysis:", e);
    return null;
  }
}
