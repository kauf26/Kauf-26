export type MarketplaceIntegrationType = "API" | "Manual";

export interface MarketplaceDefinition {
  name: string;
  slug: string;
  integrationType: MarketplaceIntegrationType;
}

/**
 * Canonical marketplace list for Kauf26 integrations.
 * Exactly 26 entries: 24 API-capable targets + 2 manual workflows.
 */
export const MARKETPLACES: MarketplaceDefinition[] = [
  { name: "eBay", slug: "ebay", integrationType: "API" },
  { name: "Shopify", slug: "shopify", integrationType: "API" },
  { name: "Amazon", slug: "amazon", integrationType: "API" },
  { name: "Etsy", slug: "etsy", integrationType: "API" },
  { name: "StockX", slug: "stockx", integrationType: "API" },
  { name: "Back Market", slug: "back-market", integrationType: "API" },
  { name: "Swappa", slug: "swappa", integrationType: "API" },
  { name: "Vinted", slug: "vinted", integrationType: "API" },
  { name: "GOAT", slug: "goat", integrationType: "API" },
  { name: "Vestiaire Collective", slug: "vestiaire-collective", integrationType: "API" },
  { name: "Grailed", slug: "grailed", integrationType: "API" },
  { name: "The RealReal", slug: "the-realreal", integrationType: "API" },
  { name: "Zalando", slug: "zalando", integrationType: "API" },
  { name: "TikTok Shop", slug: "tiktok-shop", integrationType: "API" },
  { name: "Whatnot", slug: "whatnot", integrationType: "API" },
  { name: "Reverb", slug: "reverb", integrationType: "API" },
  { name: "BrickLink", slug: "bricklink", integrationType: "API" },
  { name: "Discogs", slug: "discogs", integrationType: "API" },
  { name: "Mercado Libre", slug: "mercado-libre", integrationType: "API" },
  { name: "Rakuten", slug: "rakuten", integrationType: "API" },
  { name: "Allegro", slug: "allegro", integrationType: "API" },
  { name: "Bol.com", slug: "bol-com", integrationType: "API" },
  { name: "Kaufland", slug: "kaufland", integrationType: "API" },
  { name: "Cdiscount", slug: "cdiscount", integrationType: "API" },
  { name: "Poshmark", slug: "poshmark", integrationType: "Manual" },
  { name: "Depop", slug: "depop", integrationType: "Manual" },
];
