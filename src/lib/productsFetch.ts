import {
  countUniqueProductDrafts,
  dedupeDraftRowsById,
} from "@shared/draftCount";
import { fetchJsonDeduped, fetchOptionalEndpoint } from "./stableFetch";

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
  sku?: unknown;
  images?: unknown;
  attributes?: Record<string, unknown> | null;
};

const PRODUCTS_QUERY_KEY = ["products"] as const;
export const PRODUCT_DRAFT_COUNT_QUERY_KEY = ["productDraftCount", "v2"] as const;
export { PRODUCTS_QUERY_KEY, countUniqueProductDrafts, dedupeDraftRowsById };

let productsInFlight: Promise<ListingProduct[]> | null = null;

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
  const drafts = await fetchJsonDeduped<ProductDraftRow[]>(
    `${PRODUCTS_QUERY_KEY.join("/")}:drafts`,
    "/api/drafts"
  );
  if (!Array.isArray(drafts)) return [];
  return dedupeDraftRowsById(drafts).map(draftToListingProduct);
}

/** Distinct product count for dashboard stats (one logical product per fingerprint). */
export async function fetchProductDraftCount(): Promise<number> {
  const data = await fetchOptionalEndpoint(
    PRODUCT_DRAFT_COUNT_QUERY_KEY.join("/"),
    "/api/drafts/count",
    { count: 0 }
  );
  const parsed = Number(data.count);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Deduplicates concurrent product list fetches across components. */
export async function fetchProducts(): Promise<ListingProduct[]> {
  if (productsInFlight) {
    return productsInFlight;
  }

  productsInFlight = fetchDraftProductsOnce().finally(() => {
    productsInFlight = null;
  });

  return productsInFlight;
}

/** Drop in-memory dedupe so the next listing flow fetches fresh data. */
export function clearProductsFetchCache(): void {
  productsInFlight = null;
}
