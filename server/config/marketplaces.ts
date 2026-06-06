/**
 * Canonical multi-marketplace configuration — single source of truth.
 */

export type MarketplaceApiMethod = "open" | "partnership" | "web";

export type ImplementationStatus =
  | "live"
  | "dry-run"
  | "partnership-stub"
  | "web-stub";

export type MasterMarketplace = {
  id: string;
  name: string;
  currency: string;
  country: string;
  apiMethod: MarketplaceApiMethod;
  enabledForPublishing: boolean;
  credentialsRequired: string[];
  /** Env var names (uppercase) checked by adapters */
  envKeys: string[];
  implementationStatus: ImplementationStatus;
};

export const MASTER_MARKETPLACES: MasterMarketplace[] = [
  {
    id: "ebay",
    name: "eBay",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret", "refreshToken"],
    envKeys: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN"],
    implementationStatus: "live",
  },
  {
    id: "amazon",
    name: "Amazon",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: [
      "clientId",
      "clientSecret",
      "refreshToken",
      "sellerId",
    ],
    envKeys: [
      "AMAZON_CLIENT_ID",
      "AMAZON_CLIENT_SECRET",
      "AMAZON_REFRESH_TOKEN",
      "AMAZON_SELLER_ID",
    ],
    implementationStatus: "dry-run",
  },
  {
    id: "mercari",
    name: "Mercari US",
    currency: "USD",
    country: "US",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["partnershipKey"],
    envKeys: ["MERCARI_PARTNERSHIP_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "mercari-jp",
    name: "Mercari Japan",
    currency: "JPY",
    country: "JP",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["partnershipKey"],
    envKeys: ["MERCARI_JP_PARTNERSHIP_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "stockx",
    name: "StockX",
    currency: "USD",
    country: "US",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["STOCKX_API_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "grailed",
    name: "Grailed",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["GRAILED_API_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    currency: "USD",
    country: "US",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["WHATNOT_API_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "depop",
    name: "Depop",
    currency: "USD",
    country: "US",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["DEPOP_API_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "discogs",
    name: "Discogs",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiToken"],
    envKeys: ["DISCOGS_API_TOKEN"],
    implementationStatus: "dry-run",
  },
  {
    id: "poshmark",
    name: "Poshmark",
    currency: "USD",
    country: "US",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["partnershipKey"],
    envKeys: ["POSHMARK_PARTNERSHIP_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "etsy",
    name: "Etsy",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey", "oauthClientId", "refreshToken", "shopId"],
    envKeys: [
      "ETSY_API_KEY",
      "ETSY_CLIENT_ID",
      "ETSY_REFRESH_TOKEN",
      "ETSY_SHOP_ID",
    ],
    implementationStatus: "dry-run",
  },
  {
    id: "shopify",
    name: "Shopify",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["shopDomain", "accessToken"],
    envKeys: ["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ACCESS_TOKEN"],
    implementationStatus: "dry-run",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["siteUrl", "consumerKey", "consumerSecret"],
    envKeys: [
      "WOOCOMMERCE_SITE_URL",
      "WOOCOMMERCE_CONSUMER_KEY",
      "WOOCOMMERCE_CONSUMER_SECRET",
    ],
    implementationStatus: "dry-run",
  },
  {
    id: "squarespace",
    name: "Squarespace",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["SQUARESPACE_API_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "wix",
    name: "Wix eCommerce",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey", "siteId"],
    envKeys: ["WIX_API_KEY", "WIX_SITE_ID"],
    implementationStatus: "dry-run",
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    currency: "EUR",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["siteUrl", "apiKey"],
    envKeys: ["PRESTASHOP_SITE_URL", "PRESTASHOP_API_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    currency: "USD",
    country: "LATAM",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret", "refreshToken"],
    envKeys: [
      "MERCADOLIBRE_CLIENT_ID",
      "MERCADOLIBRE_CLIENT_SECRET",
      "MERCADOLIBRE_REFRESH_TOKEN",
    ],
    implementationStatus: "dry-run",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["accessToken"],
    envKeys: ["PINTEREST_ACCESS_TOKEN"],
    implementationStatus: "dry-run",
  },
  {
    id: "tiktokshop",
    name: "TikTok Shop",
    currency: "USD",
    country: "Global",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["appKey", "appSecret"],
    envKeys: ["TIKTOKSHOP_APP_KEY", "TIKTOKSHOP_APP_SECRET"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "vinted",
    name: "Vinted",
    currency: "EUR",
    country: "Europe",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["VINTED_API_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "shopee",
    name: "Shopee",
    currency: "USD",
    country: "SEA",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["partnerId", "partnerKey", "shopId"],
    envKeys: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID"],
    implementationStatus: "dry-run",
  },
  {
    id: "falabella",
    name: "Falabella",
    currency: "USD",
    country: "LATAM",
    apiMethod: "partnership",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["FALABELLA_API_KEY"],
    implementationStatus: "partnership-stub",
  },
  {
    id: "bolcom",
    name: "Bol.com",
    currency: "EUR",
    country: "NL",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret"],
    envKeys: ["BOLCOM_CLIENT_ID", "BOLCOM_CLIENT_SECRET"],
    implementationStatus: "dry-run",
  },
  {
    id: "allegro",
    name: "Allegro",
    currency: "PLN",
    country: "PL",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret"],
    envKeys: ["ALLEGRO_CLIENT_ID", "ALLEGRO_CLIENT_SECRET"],
    implementationStatus: "live",
  },
  {
    id: "cdiscount",
    name: "Cdiscount",
    currency: "EUR",
    country: "FR",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["sellerId", "apiKey"],
    envKeys: ["CDISCOUNT_SELLER_ID", "CDISCOUNT_API_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "kidizen",
    name: "Kidizen",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey"],
    envKeys: ["KIDIZEN_API_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "facebook",
    name: "Facebook Marketplace",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: false,
    credentialsRequired: ["accessToken", "catalogId"],
    envKeys: ["FACEBOOK_ACCESS_TOKEN", "FACEBOOK_CATALOG_ID"],
    implementationStatus: "live",
  },
];

const byId = new Map(MASTER_MARKETPLACES.map((m) => [m.id, m]));

/** @deprecated Use MASTER_MARKETPLACES */
export const MARKETPLACES = MASTER_MARKETPLACES.map((m) => ({
  name: m.id,
  displayName: m.name,
  enabled: m.enabledForPublishing,
  api: m.apiMethod === "open" ? ("rest" as const) : ("web" as const),
  auth: m.credentialsRequired.length ? ("oauth" as const) : ("none" as const),
}));

export function getMarketplaceConfig(id: string): MasterMarketplace | undefined {
  return byId.get(id.toLowerCase());
}

export function getEnabledMarketplaceIds(): string[] {
  return MASTER_MARKETPLACES.filter((m) => m.enabledForPublishing).map(
    (m) => m.id
  );
}

export function isMarketplaceEnabled(id: string): boolean {
  return getMarketplaceConfig(id)?.enabledForPublishing === true;
}

export function resolveMarketplaceTargets(requested?: string[]): string[] {
  const defaults =
    process.env.DEFAULT_PUBLISH_MARKETPLACES?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? getEnabledMarketplaceIds();

  const raw =
    requested && requested.length > 0
      ? requested.map((s) => s.trim().toLowerCase()).filter(Boolean)
      : defaults;

  const resolved: string[] = [];
  for (const id of raw) {
    const cfg = getMarketplaceConfig(id);
    if (!cfg) {
      console.warn(`[Marketplaces] Unknown marketplace "${id}" — skipped`);
      continue;
    }
    if (!cfg.enabledForPublishing) {
      console.warn(
        `[Marketplaces] "${id}" is disabled for publishing — skipped`
      );
      continue;
    }
    resolved.push(cfg.id);
  }
  return [...new Set(resolved)];
}

export const SUPPORTED_MARKETPLACE_IDS = MASTER_MARKETPLACES.map((m) => m.id);

export type MarketplaceConfig = (typeof MARKETPLACES)[number];
