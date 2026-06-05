/**
 * Multi-marketplace publish adapters.
 * Each adapter maps a draft → marketplace listing format and posts (or dry-runs).
 */

export type DraftPublishPayload = {
  draftId: number;
  title: string;
  sku?: string | null;
  images: string[];
  attributes: Record<string, unknown>;
};

export type PublishResult = {
  marketplaceId: string;
  success: boolean;
  listingId?: string;
  message: string;
  dryRun: boolean;
};

type MarketplaceAdapter = {
  id: string;
  envKeys: string[];
  format: (draft: DraftPublishPayload) => Record<string, unknown>;
  publish: (
    formatted: Record<string, unknown>
  ) => Promise<{ listingId?: string; message: string }>;
};

function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => Boolean(process.env[k]?.trim()));
}

function baseListing(draft: DraftPublishPayload): Record<string, unknown> {
  const a = draft.attributes ?? {};
  const market = (a.marketPrices as Record<string, string>) ?? {};
  return {
    title: draft.title,
    brand: a.brand ?? "",
    model: a.model ?? "",
    description: a.longDescription ?? a.aiDescription ?? "",
    condition: a.condition ?? "Used",
    color: a.color ?? "",
    material: a.material ?? "",
    style: a.style ?? "",
    price: parseFloat(market.recommendedPrice ?? String(a.medianPrice ?? "0")) || 0,
    images: draft.images?.length ?? 0,
    sku: draft.sku ?? undefined,
  };
}

const adapters: MarketplaceAdapter[] = [
  {
    id: "ebay",
    envKeys: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN"],
    format: (draft) => ({
      ...baseListing(draft),
      marketplace: "EBAY_US",
      listingFormat: "FIXED_PRICE",
      categoryId: "93427",
    }),
    publish: async (formatted) => {
      if (!hasEnv("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN")) {
        return {
          message: "eBay OAuth credentials missing — dry run only",
        };
      }
      // TODO: POST https://api.ebay.com/sell/inventory/v1/inventory_item
      console.log("[Publish][eBay] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `ebay-stub-${Date.now()}`, message: "eBay listing queued (stub)" };
    },
  },
  {
    id: "allegro",
    envKeys: ["ALLEGRO_CLIENT_ID", "ALLEGRO_CLIENT_SECRET"],
    format: (draft) => ({
      ...baseListing(draft),
      marketplace: "allegro-pl",
      currency: "PLN",
    }),
    publish: async (formatted) => {
      if (!hasEnv("ALLEGRO_CLIENT_ID", "ALLEGRO_CLIENT_SECRET")) {
        return { message: "Allegro API credentials missing — dry run only" };
      }
      console.log("[Publish][Allegro] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `allegro-stub-${Date.now()}`, message: "Allegro offer queued (stub)" };
    },
  },
  {
    id: "facebook",
    envKeys: ["FACEBOOK_ACCESS_TOKEN", "FACEBOOK_CATALOG_ID"],
    format: (draft) => ({
      ...baseListing(draft),
      marketplace: "facebook_marketplace",
    }),
    publish: async (formatted) => {
      if (!hasEnv("FACEBOOK_ACCESS_TOKEN")) {
        return { message: "Facebook Graph token missing — dry run only" };
      }
      console.log("[Publish][Facebook] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `fb-stub-${Date.now()}`, message: "Facebook listing queued (stub)" };
    },
  },
  {
    id: "offerup",
    envKeys: ["OFFERUP_API_KEY"],
    format: (draft) => ({ ...baseListing(draft), marketplace: "offerup" }),
    publish: async (formatted) => {
      console.log("[Publish][OfferUp] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `offerup-stub-${Date.now()}`, message: "OfferUp listing queued (stub)" };
    },
  },
  {
    id: "poshmark",
    envKeys: ["POSHMARK_API_KEY"],
    format: (draft) => ({ ...baseListing(draft), marketplace: "poshmark" }),
    publish: async (formatted) => {
      console.log("[Publish][Poshmark] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `poshmark-stub-${Date.now()}`, message: "Poshmark listing queued (stub)" };
    },
  },
  {
    id: "mercari",
    envKeys: ["MERCARI_API_KEY"],
    format: (draft) => ({ ...baseListing(draft), marketplace: "mercari" }),
    publish: async (formatted) => {
      console.log("[Publish][Mercari] payload:", JSON.stringify(formatted, null, 2));
      return { listingId: `mercari-stub-${Date.now()}`, message: "Mercari listing queued (stub)" };
    },
  },
];

const adapterMap = new Map(adapters.map((a) => [a.id, a]));

export const SUPPORTED_MARKETPLACE_IDS = adapters.map((a) => a.id);

export async function publishDraftToMarketplace(
  marketplaceId: string,
  draft: DraftPublishPayload
): Promise<PublishResult> {
  const adapter = adapterMap.get(marketplaceId);
  if (!adapter) {
    return {
      marketplaceId,
      success: false,
      dryRun: true,
      message: `Unknown marketplace: ${marketplaceId}`,
    };
  }

  const formatted = adapter.format(draft);
  const credentialed = adapter.envKeys.every((k) => hasEnv(k));
  const result = await adapter.publish(formatted);

  return {
    marketplaceId,
    success: true,
    listingId: result.listingId,
    message: result.message,
    dryRun: !credentialed,
  };
}

export async function publishDraftToMarketplaces(
  draft: DraftPublishPayload,
  marketplaceIds: string[]
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const id of marketplaceIds) {
    results.push(await publishDraftToMarketplace(id, draft));
  }
  return results;
}

export function draftToPublishPayload(draft: {
  id: number;
  title: string;
  sku?: string | null;
  images?: unknown;
  attributes?: unknown;
}): DraftPublishPayload {
  return {
    draftId: draft.id,
    title: draft.title,
    sku: draft.sku,
    images: Array.isArray(draft.images) ? (draft.images as string[]) : [],
    attributes:
      draft.attributes && typeof draft.attributes === "object"
        ? (draft.attributes as Record<string, unknown>)
        : {},
  };
}
