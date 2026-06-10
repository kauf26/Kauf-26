import { useQuery } from "@tanstack/react-query";
import {
  fetchSales,
  SALES_QUERY_KEY,
  type DashboardSale,
} from "@/lib/salesFetch";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";

type UseSalesOptions = {
  enabled?: boolean;
};

export function useSales(options: UseSalesOptions = {}) {
  const { enabled = true } = options;

  return useQuery<DashboardSale[]>({
    queryKey: SALES_QUERY_KEY,
    queryFn: fetchSales,
    enabled,
    ...STABLE_QUERY_OPTIONS,
  });
}
