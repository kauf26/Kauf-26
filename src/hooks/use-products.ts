import { useQuery } from "@tanstack/react-query";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";
import {
  fetchProducts,
  PRODUCTS_QUERY_KEY,
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
    ...STABLE_QUERY_OPTIONS,
  });
}
