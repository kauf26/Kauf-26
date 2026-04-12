/** Target language + listing currency per marketplace (aligned with client create flow). */
export const marketplaceLocale: Record<string, { lang: string; currency: string }> = {
  ebay: { lang: "en", currency: "USD" },
  amazon: { lang: "en", currency: "USD" },
  mercari: { lang: "en", currency: "USD" },
  "mercari-jp": { lang: "ja", currency: "JPY" },
  stockx: { lang: "en", currency: "USD" },
  grailed: { lang: "en", currency: "USD" },
  whatnot: { lang: "en", currency: "USD" },
  tcgplayer: { lang: "en", currency: "USD" },
  discogs: { lang: "en", currency: "USD" },
  poshmark: { lang: "en", currency: "USD" },
  gumtree: { lang: "en", currency: "AUD" },
  etsy: { lang: "en", currency: "USD" },
  shopify: { lang: "en", currency: "USD" },
  woocommerce: { lang: "en", currency: "USD" },
  squarespace: { lang: "en", currency: "USD" },
  wix: { lang: "en", currency: "USD" },
  prestashop: { lang: "en", currency: "EUR" },
  mercadolibre: { lang: "es", currency: "USD" },
  pinterest: { lang: "en", currency: "USD" },
  tiktokshop: { lang: "en", currency: "USD" },
  wallapop: { lang: "es", currency: "EUR" },
  vinted: { lang: "en", currency: "EUR" },
  shopee: { lang: "pt", currency: "BRL" },
  olx: { lang: "pt", currency: "BRL" },
  falabella: { lang: "es", currency: "USD" },
  bolcom: { lang: "nl", currency: "EUR" },
};

export const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  MXN: 17.2,
  BRL: 5.1,
  AUD: 1.52,
  CAD: 1.35,
};

export function resolveMarketplaceLocale(marketplace: string): { lang: string; currency: string } {
  return marketplaceLocale[marketplace] ?? { lang: "en", currency: "USD" };
}
