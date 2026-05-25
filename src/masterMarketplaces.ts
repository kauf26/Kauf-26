// src/masterMarketplaces.ts

export const MASTER_MARKETPLACES = [
    { id: "ebay", name: "eBay", currency: "USD", country: "🇺🇸" },
    { id: "amazon", name: "Amazon", currency: "USD", country: "🇺🇸" },
    { id: "mercari", name: "Mercari US", currency: "USD", country: "🇺🇸" },
    { id: "mercari-jp", name: "Mercari Japan", currency: "JPY", country: "🇯🇵" },
    { id: "stockx", name: "StockX", currency: "USD", country: "🇺🇸" },
    { id: "grailed", name: "Grailed", currency: "USD", country: "🇺🇸" },
    { id: "whatnot", name: "Whatnot", currency: "USD", country: "🇺🇸" },
    { id: "depop", name: "Depop", currency: "USD", country: "🇺🇸" },
    { id: "discogs", name: "Discogs", currency: "USD", country: "🇺🇸" },
    { id: "poshmark", name: "Poshmark", currency: "USD", country: "🇺🇸" },
    { id: "gumtree", name: "Gumtree", currency: "AUD", country: "🇦🇺" },
    { id: "etsy", name: "Etsy", currency: "USD", country: "🇺🇸" },
    { id: "shopify", name: "Shopify", currency: "USD", country: "🇨🇦" },
    { id: "woocommerce", name: "WooCommerce", currency: "USD", country: "🇺🇸" },
    { id: "squarespace", name: "Squarespace", currency: "USD", country: "🇺🇸" },
    { id: "wix", name: "Wix eCommerce", currency: "USD", country: "🇮🇱" },
    { id: "prestashop", name: "PrestaShop", currency: "EUR", country: "🇫🇷" },
    { id: "mercadolibre", name: "Mercado Libre", currency: "USD", country: "🇲🇽" },
    { id: "pinterest", name: "Pinterest", currency: "USD", country: "🇺🇸" },
    { id: "tiktokshop", name: "TikTok Shop", currency: "USD", country: "🌏" },
    { id: "wallapop", name: "Wallapop", currency: "EUR", country: "🇪🇸" },
    { id: "vinted", name: "Vinted", currency: "EUR", country: "🇪🇺" },
    { id: "shopee", name: "Shopee", currency: "BRL", country: "🇧🇷" },
    { id: "olx", name: "OLX", currency: "BRL", country: "🇧🇷" },
    { id: "falabella", name: "Falabella", currency: "USD", country: "🇨🇱" },
    { id: "bolcom", name: "Bol.com", currency: "EUR", country: "🇳🇱" },
   ] as const;
   
   export type Marketplace = typeof MASTER_MARKETPLACES[number];