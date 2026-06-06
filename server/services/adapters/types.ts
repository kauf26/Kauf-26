import type { DraftPublishPayload } from "../../publishToMarketplaces";

export type FormattedListing = Record<string, unknown>;

export type AdapterPublishResult = {
  listingId?: string;
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
