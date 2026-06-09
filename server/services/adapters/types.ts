import type { DraftPublishPayload } from "../../publishToMarketplaces";

export type FormattedListing = Record<string, unknown>;

export type AdapterPublishResult = {
  listingId?: string;
  /** Direct link to the live (or admin) listing, when the marketplace provides one. */
  listingUrl?: string;
  /** Account/shop identity the listing was published under (e.g. store domain, shop ID). */
  account?: string;
  message: string;
  dryRun?: boolean;
};

export type MarketplaceAdapter = {
  id: string;
  format: (draft: DraftPublishPayload) => FormattedListing;
  publish: (
    formatted: FormattedListing,
    fetchImpl?: FetchFn
  ) => Promise<AdapterPublishResult>;
  isConfigured: () => boolean;
};

export type FetchFn = typeof fetch;
