import { API_BASE_URL } from './api';
import type { SoldProductsResponse } from '../../../shared/soldProducts';

export type { SoldProductSummary, SoldProductsResponse } from '../../../shared/soldProducts';

export async function fetchSoldProducts(
  page = 1,
  limit = 20
): Promise<SoldProductsResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE_URL}/api/sales/products?${query.toString()}`);
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<SoldProductsResponse>;
}
