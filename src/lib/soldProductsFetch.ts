import { fetchOptionalEndpoint } from "./stableFetch";
import type { SoldProductsResponse } from "../../shared/soldProducts";

export const SOLD_PRODUCTS_QUERY_KEY = ["soldProducts"] as const;

export type FetchSoldProductsParams = {
  page?: number;
  limit?: number;
};

const EMPTY_SOLD_PRODUCTS: SoldProductsResponse = {
  totalSoldProducts: 0,
  products: [],
  page: 1,
  limit: 20,
  hasMore: false,
};

export function fetchSoldProducts(
  params: FetchSoldProductsParams = {}
): Promise<SoldProductsResponse> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return fetchOptionalEndpoint(
    `${SOLD_PRODUCTS_QUERY_KEY.join("/")}:${page}:${limit}`,
    `/api/sales/products?${query.toString()}`,
    { ...EMPTY_SOLD_PRODUCTS, page, limit }
  );
}
