/**
 * Reject non-product Google organic results (social pages, menus, events, etc.).
 * Only allow known marketplaces or direct brand product URLs with listing signals.
 */

const BLOCKED_HOST_RE =
  /(?:^|\.)((?:facebook|instagram|yelp|twitter|x|tiktok|linkedin|pinterest|reddit|maps\.google|google\.com\/maps|tripadvisor|foursquare)\.[a-z.]+)/i;

const BLOCKED_PATH_RE =
  /\/(menu|menus|events?|hours|contact|about|blog|reels?|stories|posts?|groups?|pages?|p\/|biz\/|restaurant)/i;

const BLOCKED_TITLE_RE =
  /\b(menu|happy hour|wing night|hours|open at|closed at|reservation|follow us|reel|instagram|facebook page|yelp review|must-?try bar|food gem|review of)\b/i;

/** Known resale / retail marketplaces */
const MARKETPLACE_HOST_RE =
  /(?:^|\.)((?:ebay|allegro|amazon|etsy|poshmark|mercari|depop|grailed|offerup|bonanza|rubylane|thredup|vestiairecollective|chrono24|watchfinder|therealreal|stockx|goat|vinted|asos|zara|nike|adidas|shopify)\.[a-z.]+)/i;

const PRODUCT_PATH_RE =
  /\/(item|listing|product|p|dp|itm|offer|sku|goods|buy|shop|store)\/|\/\d{6,}|[?&](item|product|sku|itm)=/i;

const BUY_SIGNAL_RE =
  /\b(add to cart|buy now|add to bag|shop now|in stock|free shipping|buy it now|make offer|listings?)\b/i;

const PRODUCT_IMAGE_SIGNAL_RE =
  /\b(product image|thumbnail|gallery|photos? of|item for sale|pre-?owned|used condition)\b/i;

export type ProductPageVerdict = {
  accept: boolean;
  reason: string;
  isMarketplace: boolean;
};

export function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_RE.test(host) || BLOCKED_PATH_RE.test(url.toLowerCase());
  } catch {
    return true;
  }
}

export function isKnownMarketplaceUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MARKETPLACE_HOST_RE.test(host);
  } catch {
    return false;
  }
}

export function hasProductListingStructure(
  title: string,
  description: string,
  url: string
): boolean {
  const blob = `${title} ${description}`.toLowerCase();
  const pathOk = PRODUCT_PATH_RE.test(url);
  const buySignal = BUY_SIGNAL_RE.test(blob);
  const imageSignal = PRODUCT_IMAGE_SIGNAL_RE.test(blob);
  return pathOk || buySignal || imageSignal;
}

export function evaluateOrganicResult(input: {
  title: string;
  url: string;
  description?: string;
  price?: number;
}): ProductPageVerdict {
  const title = String(input.title ?? "").trim();
  const url = String(input.url ?? "").trim();
  const description = String(input.description ?? "");
  const price = Number(input.price ?? 0);

  if (!title || !url) {
    return { accept: false, reason: "missing_title_or_url", isMarketplace: false };
  }

  if (isBlockedHost(url)) {
    return { accept: false, reason: "blocked_host", isMarketplace: false };
  }

  if (BLOCKED_TITLE_RE.test(title) || BLOCKED_TITLE_RE.test(description)) {
    return { accept: false, reason: "blocked_title_menu_or_event", isMarketplace: false };
  }

  const marketplace = isKnownMarketplaceUrl(url);

  if (!marketplace) {
    const brandProduct =
      hasProductListingStructure(title, description, url) && price >= 5;
    if (!brandProduct) {
      return {
        accept: false,
        reason: "not_marketplace_and_no_product_structure",
        isMarketplace: false,
      };
    }
  }

  if (price <= 0 && !marketplace) {
    return { accept: false, reason: "no_clear_price", isMarketplace: marketplace };
  }

  if (!hasProductListingStructure(title, description, url) && !marketplace) {
    return {
      accept: false,
      reason: "no_product_listing_structure",
      isMarketplace: false,
    };
  }

  return { accept: true, reason: marketplace ? "marketplace" : "brand_product_page", isMarketplace: marketplace };
}
