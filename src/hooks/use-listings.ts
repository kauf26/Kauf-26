import { useQuery } from "@tanstack/react-query";
import {
  fetchListings,
  LISTINGS_QUERY_KEY,
  type DashboardListing,
} from "@/lib/listingsFetch";
import { STABLE_QUERY_OPTIONS } from "@/lib/stableFetch";

type UseListingsOptions = {
  enabled?: boolean;
};

export function useListings(options: UseListingsOptions = {}) {
  const { enabled = true } = options;

  return useQuery<DashboardListing[]>({
    queryKey: LISTINGS_QUERY_KEY,
    queryFn: fetchListings,
    enabled,
    ...STABLE_QUERY_OPTIONS,
  });
}
