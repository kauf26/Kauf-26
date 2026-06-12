export type MarketplaceListingUrlOptions = {
  shopDomain?: string | null;
  /** When true, eBay links use sandbox host. */
  sandbox?: boolean;
};

/**
 * Build a public marketplace listing URL from marketplace id + external listing id.
 * Returns null when the marketplace/id pair cannot form a stable public URL.
 */
export function buildMarketplaceListingUrl(
  marketplace: string,
  listingId: string | null | undefined,
  options: MarketplaceListingUrlOptions = {}
): string | null {
  const id = String(listingId ?? "").trim();
  if (!id) return null;

  const mp = marketplace.toLowerCase().trim();
  const shopDomain = normalizeShopDomain(options.shopDomain);

  switch (mp) {
    case "etsy":
      return `https://www.etsy.com/listing/${id}`;
    case "ebay":
      return `${options.sandbox ? "https://www.sandbox.ebay.com" : "https://www.ebay.com"}/itm/${id}`;
    case "amazon":
      return `https://www.amazon.com/dp/${id}`;
    case "shopify":
      return shopDomain ? `https://${shopDomain}/products/${id}` : null;
    case "woocommerce":
      return shopDomain ? `${shopDomain.replace(/\/$/, "")}/?p=${id}` : null;
    case "depop":
      return `https://www.depop.com/products/${id}`;
    case "poshmark":
      return `https://poshmark.com/listing/${id}`;
    case "mercadolibre":
      return `https://articulo.mercadolibre.com.mx/${id}`;
    case "mercadolibre_br":
      return `https://produto.mercadolivre.com.br/${id}`;
    case "vinted":
      return `https://www.vinted.com/items/${id}`;
    case "allegro":
      return `https://allegro.pl/oferta/${id}`;
    case "bolcom":
      return `https://www.bol.com/nl/n/p/${id}`;
    case "rakuten":
      return `https://item.rakuten.co.jp/${id}`;
    case "shopee":
      return shopDomain
        ? `https://${shopDomain}/product/${id}`
        : `https://shopee.com/product/${id}`;
    case "lazada":
      return `https://www.lazada.com/products/${id}.html`;
    case "tiktokshop":
      return `https://shop.tiktok.com/view/product/${id}`;
    case "stockx":
      return `https://stockx.com/${id}`;
    case "newegg":
      return `https://www.newegg.com/p/${id}`;
    case "wayfair":
      return `https://www.wayfair.com/pdp/${id}.html`;
    default:
      return null;
  }
}

export function truncateListingUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  const head = Math.max(20, Math.floor(max * 0.55));
  const tail = Math.max(8, max - head - 1);
  return `${url.slice(0, head)}…${url.slice(-tail)}`;
}

function normalizeShopDomain(shopDomain?: string | null): string | null {
  const raw = String(shopDomain ?? "").trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
