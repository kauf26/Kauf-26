import { API_BASE_URL } from './config';
import { parseJsonResponse } from './httpResponse';

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

let inFlight: Promise<ListingProduct[]> | null = null;
let lastFailureAt = 0;
let backoffMs = 1000;

function draftToListingProduct(draft: ProductDraftRow): ListingProduct {
  const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
  const images = Array.isArray(draft.images) ? draft.images : [];
  const imageUrl =
    (typeof images[0] === 'string' ? images[0] : '') ||
    (typeof attrs.imageUrl === 'string' ? attrs.imageUrl : '');

  return {
    id: draft.id,
    imageUrl,
    originalTitle:
      String(draft.title ?? attrs.originalTitle ?? 'Untitled').trim() ||
      'Untitled',
    aiDescription: String(
      attrs.longDescription ?? attrs.aiDescription ?? attrs.description ?? ''
    ).trim(),
    basePrice: String(
      attrs.recommendedPrice ?? attrs.medianPrice ?? attrs.price ?? '0.00'
    ),
    currency: String(attrs.currency ?? 'USD'),
  };
}

async function loadDraftProducts(): Promise<ListingProduct[]> {
  const response = await fetch(`${API_BASE_URL}/api/drafts`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const drafts = await parseJsonResponse<ProductDraftRow[]>(response);
  return Array.isArray(drafts) ? drafts.map(draftToListingProduct) : [];
}

function noteFailure(): void {
  lastFailureAt = Date.now();
  backoffMs = Math.min(backoffMs * 2, 8000);
}

function noteSuccess(): void {
  backoffMs = 1000;
  lastFailureAt = 0;
}

async function waitForBackoff(): Promise<void> {
  if (lastFailureAt === 0) return;
  const elapsed = Date.now() - lastFailureAt;
  const remaining = backoffMs - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/** Deduplicated product list fetch with exponential backoff after errors. */
export async function fetchProductsWithBackoff(): Promise<ListingProduct[]> {
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    await waitForBackoff();
    try {
      const products = await loadDraftProducts();
      noteSuccess();
      return products;
    } catch (error) {
      noteFailure();
      throw error;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
