import { fetchOptionalEndpoint } from "./stableFetch";
import type { PublishedListing } from "../../shared/publishedListings";

export type { PublishedListing };
export type DashboardListing = PublishedListing;

export const LISTINGS_QUERY_KEY = ["listings"] as const;

export function fetchListings(): Promise<PublishedListing[]> {
  return fetchOptionalEndpoint(
    LISTINGS_QUERY_KEY.join("/"),
    "/api/listings",
    []
  );
}
