export type ListingProduct = {
  id: number;
  imageUrl: string;
  originalTitle: string;
  aiDescription: string;
  basePrice: string;
  currency: string;
};

type ProductDraftRow = {
  id: number;
  title?: string | null;
  images?: unknown;
  attributes?: Record<string, unknown> | null;
};

const PRODUCTS_QUERY_KEY = ["products"] as const;
export { PRODUCTS_QUERY_KEY };

let inFlight: Promise<ListingProduct[]> | null = null;

function draftToListingProduct(draft: ProductDraftRow): ListingProduct {
  const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
  const images = Array.isArray(draft.images) ? draft.images : [];
  const imageUrl =
    (typeof images[0] === "string" ? images[0] : "") ||
    (typeof attrs.imageUrl === "string" ? attrs.imageUrl : "");

  return {
    id: draft.id,
    imageUrl,
    originalTitle:
      String(draft.title ?? attrs.originalTitle ?? "Untitled").trim() ||
      "Untitled",
    aiDescription: String(
      attrs.longDescription ?? attrs.aiDescription ?? attrs.description ?? ""
    ).trim(),
    basePrice: String(
      attrs.recommendedPrice ?? attrs.medianPrice ?? attrs.price ?? "0.00"
    ),
    currency: String(attrs.currency ?? "USD"),
  };
}

async function fetchDraftProductsOnce(): Promise<ListingProduct[]> {
  const res = await fetch("/api/drafts", { credentials: "include" });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  const drafts = (await res.json()) as ProductDraftRow[];
  return Array.isArray(drafts) ? drafts.map(draftToListingProduct) : [];
}

/** Deduplicates concurrent product list fetches across components. */
export async function fetchProducts(): Promise<ListingProduct[]> {
  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchDraftProductsOnce().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export function productsRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

export function shouldRetryProductsFetch(
  failureCount: number,
  error: unknown
): boolean {
  if (failureCount >= 3) return false;
  if (!(error instanceof Error)) return false;
  if (/^4\d\d:/.test(error.message)) return false;
  return true;
}
