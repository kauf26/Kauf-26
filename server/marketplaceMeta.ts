/** Target language + listing currency per marketplace **/
export const marketplaceLocale: Record<string, { lang: string, currency: string }> = {
  // --- GLOBAL P2P ---
  ebay: { lang: "en", currency: "USD" },
  etsy: { lang: "en", currency: "USD" },
  discogs: { lang: "en", currency: "USD" },
  reverb: { lang: "en", currency: "USD" },
  stockx: { lang: "en", currency: "USD" },
  grailed: { lang: "en", currency: "USD" },
  depop: { lang: "en", currency: "USD" },
  poshmark: { lang: "en", currency: "USD" },
 
  // --- FRANCE & SPAIN ANCHORS ---
  wallapop: { lang: "es", currency: "EUR" },
  vinted: { lang: "fr", currency: "EUR" },
  backmarket: { lang: "fr", currency: "EUR" },
  cdiscount: { lang: "fr", currency: "EUR" },
  manomano: { lang: "fr", currency: "EUR" },
  rakuten_fr: { lang: "fr", currency: "EUR" },
  vestiaire: { lang: "fr", currency: "EUR" },
 
  // --- REGIONAL & HOBBY ---
  mercadolibre: { lang: "es", currency: "USD" },
  cardmarket: { lang: "en", currency: "EUR" },
  allegro: { lang: "pl" , currency: "PLN" },
  gumtree: { lang: "en", currency: "GBP" },
  bonanza: { lang: "en", currency: "USD" },
  abebooks: { lang: "en", currency: "USD" },
  biblio: { lang: "en", currency: "USD" },
  rubylane: { lang: "en", currency: "USD" },
 
  // --- DIRECT STORES ---
  shopify: { lang: "en", currency: "USD" },
  woocommerce: { lang: "en", currency: "USD" },
  wix: { lang: "en", currency: "USD" },
 };
 
 export const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  MXN: 17.2,
  BRL: 5.1,
  AUD: 1.52,
  PLN: 4.01, // Added for Allegro
 };
 