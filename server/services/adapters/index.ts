import type { DraftPublishPayload } from "../../publishToMarketplaces";
import { draftToPublishPayload } from "../../publishToMarketplaces";
import { MASTER_MARKETPLACES } from "../../config/marketplaces";
import {
  formatAllegroListing,
  isAllegroConfigured,
  publishToAllegro,
} from "./allegroAdapter";
import {
  formatAmazonListing,
  isAmazonConfigured,
  publishToAmazon,
} from "./amazonAdapter";
import {
  formatEbayListing,
  isEbayConfigured,
  publishToEbay,
} from "./ebayAdapter";
import {
  formatEtsyListing,
  isEtsyConfigured,
  publishToEtsy,
} from "./etsyAdapter";
import {
  formatMercadoLibreListing,
  isMercadoLibreConfigured,
  publishToMercadoLibre,
} from "./mercadolibreAdapter";
import { openMarketplaceAdapters } from "./openMarketplaceAdapters";
import { createPartnershipAdapter } from "./partnershipAdapter";
import {
  formatShopifyListing,
  isShopifyConfigured,
  publishToShopify,
} from "./shopifyAdapter";
import type { FetchFn, MarketplaceAdapter } from "./types";
import { formatWebListing, publishToWebMarketplace } from "./webAdapter";
import {
  formatWooCommerceListing,
  isWooCommerceConfigured,
  publishToWooCommerce,
} from "./woocommerceAdapter";

export type { AdapterPublishResult, FetchFn, MarketplaceAdapter } from "./types";

const PARTNERSHIP_IDS = MASTER_MARKETPLACES.filter(
  (m) => m.apiMethod === "partnership"
).map((m) => ({ id: m.id, name: m.name }));

const partnershipAdapters = PARTNERSHIP_IDS.map((m) =>
  createPartnershipAdapter(m.id, m.name)
);

const coreAdapters: MarketplaceAdapter[] = [
  {
    id: "ebay",
    format: formatEbayListing,
    publish: (f, fetchImpl) => publishToEbay(f, fetchImpl),
    isConfigured: isEbayConfigured,
  },
  {
    id: "allegro",
    format: formatAllegroListing,
    publish: (f, fetchImpl) => publishToAllegro(f, fetchImpl),
    isConfigured: isAllegroConfigured,
  },
  {
    id: "amazon",
    format: formatAmazonListing,
    publish: (f, fetchImpl) => publishToAmazon(f, fetchImpl),
    isConfigured: isAmazonConfigured,
  },
  {
    id: "etsy",
    format: formatEtsyListing,
    publish: (f, fetchImpl) => publishToEtsy(f, fetchImpl),
    isConfigured: isEtsyConfigured,
  },
  {
    id: "shopify",
    format: formatShopifyListing,
    publish: (f, fetchImpl) => publishToShopify(f, fetchImpl),
    isConfigured: isShopifyConfigured,
  },
  {
    id: "woocommerce",
    format: formatWooCommerceListing,
    publish: (f, fetchImpl) => publishToWooCommerce(f, fetchImpl),
    isConfigured: isWooCommerceConfigured,
  },
  {
    id: "mercadolibre",
    format: formatMercadoLibreListing,
    publish: (f, fetchImpl) => publishToMercadoLibre(f, fetchImpl),
    isConfigured: isMercadoLibreConfigured,
  },
];

const registry: MarketplaceAdapter[] = [
  ...coreAdapters,
  ...openMarketplaceAdapters,
  ...partnershipAdapters,
];

const adapterMap = new Map(registry.map((a) => [a.id, a]));

export function getAdapter(marketplaceId: string): MarketplaceAdapter | undefined {
  return adapterMap.get(marketplaceId.toLowerCase());
}

export function getAllAdapterIds(): string[] {
  return [...adapterMap.keys()];
}

export function getRegisteredAdapters(): MarketplaceAdapter[] {
  return [...registry];
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
    const cfg = MASTER_MARKETPLACES.find((m) => m.id === marketplaceId);
    if (cfg?.apiMethod === "web") {
      const formatted = formatWebListing(draft, marketplaceId);
      const result = await publishToWebMarketplace(formatted, marketplaceId);
      return {
        success: true,
        marketplaceId,
        listingId: result.listingId,
        message: result.message,
        dryRun: true,
      };
    }
    return {
      success: false,
      marketplaceId,
      message: `Unknown marketplace: ${marketplaceId}`,
      dryRun: true,
    };
  }

  const normalized = draftToPublishPayload({
    id: draft.draftId,
    title: draft.title,
    sku: draft.sku,
    images: draft.images,
    attributes: draft.attributes,
  });
  const formatted = adapter.format(normalized);
  try {
    const result = await adapter.publish(formatted, fetchImpl);
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
