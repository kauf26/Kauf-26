import { useQuery } from "@tanstack/react-query";
import {
  fetchProductDraftCount,
  PRODUCT_DRAFT_COUNT_QUERY_KEY,
} from "@/lib/productsFetch";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";

type UseProductDraftCountOptions = {
  enabled?: boolean;
};

export function useProductDraftCount(options: UseProductDraftCountOptions = {}) {
  const { enabled = true } = options;

  return useQuery<number>({
    queryKey: PRODUCT_DRAFT_COUNT_QUERY_KEY,
    queryFn: fetchProductDraftCount,
    enabled,
    ...STABLE_QUERY_OPTIONS,
  });
}
