import { fetchJsonOrDefault } from "./stableFetch";

export type DashboardListing = {
  id: number;
  marketplace: string;
  status: string;
};

export const LISTINGS_QUERY_KEY = ["listings"] as const;

export function fetchListings(): Promise<DashboardListing[]> {
  return fetchJsonOrDefault(LISTINGS_QUERY_KEY.join("/"), "/api/listings", []);
}
