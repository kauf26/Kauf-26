export type MarketplaceLocale = {
  lang: string;
  currency: string;
  region: string;
};

/** Safe fallback for unknown or legacy marketplace IDs (e.g. mercari, bestbuy). */
export const DEFAULT_MARKETPLACE_LOCALE: MarketplaceLocale = {
  lang: "en",
  currency: "USD",
  region: "Global",
};

/** Target language + listing currency per marketplace (26 approved platforms). */
export const marketplaceLocale: Record<string, MarketplaceLocale> = {
  aliexpress: { lang: "zh", currency: "CNY", region: "China" },
  allegro: { lang: "pl", currency: "PLN", region: "Poland" },
  amazon: { lang: "en", currency: "USD", region: "USA" },
  bigcommerce: { lang: "en", currency: "USD", region: "Global" },
  bolcom: { lang: "nl", currency: "EUR", region: "Netherlands" },
  depop: { lang: "en", currency: "USD", region: "UK/USA" },
  ebay: { lang: "en", currency: "USD", region: "USA" },
  etsy: { lang: "en", currency: "USD", region: "USA" },
  flipkart: { lang: "en", currency: "INR", region: "India" },
  fruugo: { lang: "en", currency: "GBP", region: "Europe" },
  lazada: { lang: "en", currency: "SGD", region: "Southeast Asia" },
  magento: { lang: "en", currency: "USD", region: "Global" },
  mercadolibre: { lang: "es", currency: "ARS", region: "Latin America" },
  mercadolibre_br: { lang: "pt", currency: "BRL", region: "Brazil" },
  newegg: { lang: "en", currency: "USD", region: "USA" },
  poshmark: { lang: "en", currency: "USD", region: "USA" },
  rakuten: { lang: "ja", currency: "JPY", region: "Japan" },
  shopee: { lang: "en", currency: "SGD", region: "Southeast Asia" },
  shopify: { lang: "en", currency: "USD", region: "Global" },
  stockx: { lang: "en", currency: "USD", region: "USA" },
  taobao: { lang: "zh", currency: "CNY", region: "China" },
  tiktokshop: { lang: "en", currency: "USD", region: "Global" },
  vinted: { lang: "en", currency: "EUR", region: "Europe" },
  wayfair: { lang: "en", currency: "USD", region: "USA" },
  woocommerce: { lang: "en", currency: "USD", region: "Global" },
  zalando: { lang: "de", currency: "EUR", region: "Germany" },
};

/** Resolve locale for any marketplace ID; unknown IDs get USD/en defaults. */
export function getMarketplaceLocale(marketplaceId: string | null | undefined): MarketplaceLocale {
  const id = String(marketplaceId ?? "").trim().toLowerCase();
  if (!id) return DEFAULT_MARKETPLACE_LOCALE;
  return marketplaceLocale[id] ?? DEFAULT_MARKETPLACE_LOCALE;
}

/** Resolve listing currency for any marketplace ID. */
export function getMarketplaceListingCurrency(
  marketplaceId: string | null | undefined
): string {
  return getMarketplaceLocale(marketplaceId).currency;
}

export const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  BRL: 5.1,
  ARS: 900,
  CNY: 7.2,
  INR: 83,
  SGD: 1.35,
  PLN: 4.01,
};

const DEFAULT_CURRENCY_RATE = 1;

/** FX rate relative to USD; unknown currencies default to 1. */
export function getCurrencyRate(currency: string | null | undefined): number {
  const code = String(currency ?? "USD")
    .trim()
    .toUpperCase();
  if (!code) return DEFAULT_CURRENCY_RATE;
  return currencyRates[code] ?? DEFAULT_CURRENCY_RATE;
}
