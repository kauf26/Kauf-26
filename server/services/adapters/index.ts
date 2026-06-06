import type { DraftPublishPayload } from "../../publishToMarketplaces";
import {
  formatAllegroListing,
  isAllegroConfigured,
  publishToAllegro,
} from "./allegroAdapter";
import {
  formatEbayListing,
  isEbayConfigured,
  publishToEbay,
} from "./ebayAdapter";
import {
  formatFacebookListing,
  isFacebookConfigured,
  publishToFacebook,
} from "./facebookAdapter";
import type { FetchFn, MarketplaceAdapter } from "./types";
import { formatWebListing, publishToWebMarketplace } from "./webAdapter";

export type { AdapterPublishResult, FetchFn, MarketplaceAdapter } from "./types";

const registry: MarketplaceAdapter[] = [
  {
    id: "ebay",
    format: formatEbayListing,
    publish: (f) => publishToEbay(f),
    isConfigured: isEbayConfigured,
  },
  {
    id: "allegro",
    format: formatAllegroListing,
    publish: (f) => publishToAllegro(f),
    isConfigured: isAllegroConfigured,
  },
  {
    id: "facebook",
    format: formatFacebookListing,
    publish: (f) => publishToFacebook(f),
    isConfigured: isFacebookConfigured,
  },
  {
    id: "poshmark",
    format: (d) => formatWebListing(d, "poshmark"),
    publish: (f) => publishToWebMarketplace(f, "poshmark"),
    isConfigured: () => false,
  },
  {
    id: "mercari",
    format: (d) => formatWebListing(d, "mercari"),
    publish: (f) => publishToWebMarketplace(f, "mercari"),
    isConfigured: () => false,
  },
  {
    id: "offerup",
    format: (d) => formatWebListing(d, "offerup"),
    publish: (f) => publishToWebMarketplace(f, "offerup"),
    isConfigured: () => false,
  },
];

const adapterMap = new Map(registry.map((a) => [a.id, a]));

export function getAdapter(marketplaceId: string): MarketplaceAdapter | undefined {
  return adapterMap.get(marketplaceId.toLowerCase());
}

export function getAllAdapterIds(): string[] {
  return [...adapterMap.keys()];
}

/** Publish one marketplace (used by queue worker). */
export async function publishOne(
  marketplaceId: string,
  draft: DraftPublishPayload,
  fetchImpl?: FetchFn
): Promise<{
  success: boolean;
  marketplaceId: string;
  listingId?: string;
  message: string;
  dryRun: boolean;
}> {
  const adapter = getAdapter(marketplaceId);
  if (!adapter) {
    return {
      success: false,
      marketplaceId,
      message: `Unknown marketplace: ${marketplaceId}`,
      dryRun: true,
    };
  }

  const formatted = adapter.format(draft);
  try {
    const result = await (fetchImpl
      ? publishWithFetch(adapter, formatted, fetchImpl)
      : adapter.publish(formatted));

    return {
      success: true,
      marketplaceId,
      listingId: result.listingId,
      message: result.message,
      dryRun: result.dryRun ?? !adapter.isConfigured(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Publish][${marketplaceId}]`, message);
    return {
      success: false,
      marketplaceId,
      message,
      dryRun: false,
    };
  }
}

async function publishWithFetch(
  adapter: MarketplaceAdapter,
  formatted: Record<string, unknown>,
  fetchImpl: FetchFn
) {
  switch (adapter.id) {
    case "ebay":
      return publishToEbay(formatted, fetchImpl);
    case "allegro":
      return publishToAllegro(formatted, fetchImpl);
    case "facebook":
      return publishToFacebook(formatted, fetchImpl);
    default:
      return adapter.publish(formatted);
  }
}
