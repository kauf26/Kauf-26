import { useQuery } from "@tanstack/react-query";
import {
  fetchProducts,
  PRODUCTS_QUERY_KEY,
  productsRetryDelay,
  shouldRetryProductsFetch,
  type ListingProduct,
} from "@/lib/productsFetch";

type UseProductsOptions = {
  enabled?: boolean;
};

export function useProducts(options: UseProductsOptions = {}) {
  const { enabled = true } = options;

  return useQuery<ListingProduct[]>({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchProducts,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: shouldRetryProductsFetch,
    retryDelay: productsRetryDelay,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
