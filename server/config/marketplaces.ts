/**
 * Canonical multi-marketplace configuration — single source of truth (26 platforms).
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
    id: "aliexpress",
    name: "AliExpress",
    currency: "CNY",
    country: "CN",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["appKey", "appSecret"],
    envKeys: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
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
    id: "bigcommerce",
    name: "BigCommerce",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["storeHash", "accessToken"],
    envKeys: ["BIGCOMMERCE_STORE_HASH", "BIGCOMMERCE_ACCESS_TOKEN"],
    implementationStatus: "dry-run",
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
    id: "ebay",
    name: "eBay",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["oauthClientId", "oauthClientSecret"],
    envKeys: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    implementationStatus: "live",
  },
  {
    id: "etsy",
    name: "Etsy",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["oauthClientId"],
    envKeys: ["ETSY_CLIENT_ID"],
    implementationStatus: "live",
  },
  {
    id: "flipkart",
    name: "Flipkart",
    currency: "INR",
    country: "IN",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["appId", "appSecret"],
    envKeys: ["FLIPKART_APP_ID", "FLIPKART_APP_SECRET"],
    implementationStatus: "dry-run",
  },
  {
    id: "fruugo",
    name: "Fruugo",
    currency: "GBP",
    country: "GB",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["apiKey", "merchantId"],
    envKeys: ["FRUUGO_API_KEY", "FRUUGO_MERCHANT_ID"],
    implementationStatus: "dry-run",
  },
  {
    id: "lazada",
    name: "Lazada",
    currency: "SGD",
    country: "SG",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["appKey", "appSecret"],
    envKeys: ["LAZADA_APP_KEY", "LAZADA_APP_SECRET"],
    implementationStatus: "dry-run",
  },
  {
    id: "magento",
    name: "Magento (Adobe Commerce)",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["baseUrl", "accessToken"],
    envKeys: ["MAGENTO_BASE_URL", "MAGENTO_ACCESS_TOKEN"],
    implementationStatus: "dry-run",
  },
  {
    id: "mercadolibre",
    name: "MercadoLibre",
    currency: "ARS",
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
    id: "mercadolibre_br",
    name: "Mercado Livre (Brazil)",
    currency: "BRL",
    country: "BR",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret", "refreshToken", "siteId"],
    envKeys: [
      "MERCADOLIBRE_CLIENT_ID",
      "MERCADOLIBRE_CLIENT_SECRET",
      "MERCADOLIBRE_REFRESH_TOKEN",
      "MERCADOLIBRE_BR_SITE_ID",
    ],
    implementationStatus: "dry-run",
  },
  {
    id: "newegg",
    name: "Newegg",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["sellerId", "apiKey"],
    envKeys: ["NEWEGG_SELLER_ID", "NEWEGG_API_KEY"],
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
    id: "rakuten",
    name: "Rakuten",
    currency: "JPY",
    country: "JP",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["serviceSecret", "licenseKey"],
    envKeys: ["RAKUTEN_SERVICE_SECRET", "RAKUTEN_LICENSE_KEY"],
    implementationStatus: "dry-run",
  },
  {
    id: "shopee",
    name: "Shopee",
    currency: "SGD",
    country: "SEA",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["partnerId", "partnerKey", "shopId"],
    envKeys: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID"],
    implementationStatus: "dry-run",
  },
  {
    id: "shopify",
    name: "Shopify",
    currency: "USD",
    country: "Global",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["oauthClientId", "oauthClientSecret"],
    envKeys: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
    implementationStatus: "live",
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
    id: "taobao",
    name: "Taobao",
    currency: "CNY",
    country: "CN",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["appKey", "appSecret"],
    envKeys: ["TAOBAO_APP_KEY", "TAOBAO_APP_SECRET"],
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
    id: "wayfair",
    name: "Wayfair",
    currency: "USD",
    country: "US",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret"],
    envKeys: ["WAYFAIR_CLIENT_ID", "WAYFAIR_CLIENT_SECRET"],
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
    id: "zalando",
    name: "Zalando",
    currency: "EUR",
    country: "DE",
    apiMethod: "open",
    enabledForPublishing: true,
    credentialsRequired: ["clientId", "clientSecret"],
    envKeys: ["ZALANDO_CLIENT_ID", "ZALANDO_CLIENT_SECRET"],
    implementationStatus: "dry-run",
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
