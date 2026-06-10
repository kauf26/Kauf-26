import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSoldProducts, SOLD_PRODUCTS_QUERY_KEY } from "@/lib/soldProductsFetch";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";
import type { SoldProductsResponse } from "../../shared/soldProducts";

const PAGE_SIZE = 20;

export function useSoldProducts() {
  return useInfiniteQuery<SoldProductsResponse>({
    queryKey: SOLD_PRODUCTS_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      fetchSoldProducts({ page: pageParam as number, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    ...STABLE_QUERY_OPTIONS,
  });
}

export function flattenSoldProducts(
  pages: SoldProductsResponse[] | undefined
): SoldProductsResponse["products"] {
  if (!pages?.length) return [];
  return pages.flatMap((page) => page.products);
}
