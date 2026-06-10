import { useQuery } from "@tanstack/react-query";
import {
  fetchSalesLive,
  SALES_POLL_QUERY_KEY,
  type DashboardSale,
} from "@/lib/salesFetch";
import { POLLING_QUERY_OPTIONS } from "@/lib/stableFetch";

const SALES_POLL_INTERVAL_MS = 30_000;

type UseSalesPollOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

/** Polls /api/sales every 30s for sold-item alerts — deduped, no retry storms. */
export function useSalesPoll(options: UseSalesPollOptions = {}) {
  const { enabled = true, intervalMs = SALES_POLL_INTERVAL_MS } = options;

  return useQuery<DashboardSale[]>({
    queryKey: SALES_POLL_QUERY_KEY,
    queryFn: fetchSalesLive,
    enabled,
    ...POLLING_QUERY_OPTIONS,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
  });
}
