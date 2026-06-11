/** US vs international marketplace channel grouping (matches SelectMarketPlaces UI). */

export const MARKETPLACE_CHANNEL_REGION: Record<string, string> = {
  aliexpress: "China",
  allegro: "Poland",
  amazon: "USA",
  bigcommerce: "Global",
  bolcom: "Netherlands",
  depop: "UK/USA",
  ebay: "USA",
  etsy: "USA",
  flipkart: "India",
  fruugo: "Europe",
  lazada: "Southeast Asia",
  magento: "Global",
  mercadolibre: "Latin America",
  mercadolibre_br: "Brazil",
  newegg: "USA",
  poshmark: "USA",
  rakuten: "Japan",
  shopee: "Southeast Asia",
  shopify: "Global",
  stockx: "USA",
  taobao: "China",
  tiktokshop: "Global",
  vinted: "Europe",
  wayfair: "USA",
  woocommerce: "Global",
  zalando: "Germany",
};

export function isUsChannelMarketplace(marketplaceId: string): boolean {
  const region = MARKETPLACE_CHANNEL_REGION[marketplaceId.trim().toLowerCase()];
  if (!region) return false;
  return region === "USA" || region.includes("USA");
}

export function isInternationalChannelMarketplace(marketplaceId: string): boolean {
  const id = marketplaceId.trim().toLowerCase();
  if (!MARKETPLACE_CHANNEL_REGION[id]) return false;
  return !isUsChannelMarketplace(id);
}

export function splitMarketplaceChannels(ids: string[]): {
  us: string[];
  international: string[];
} {
  const us: string[] = [];
  const international: string[] = [];
  for (const id of ids) {
    if (isUsChannelMarketplace(id)) us.push(id);
    else if (isInternationalChannelMarketplace(id)) international.push(id);
  }
  return { us, international };
}
