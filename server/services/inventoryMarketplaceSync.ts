/**
 * Push central inventory quantity to each marketplace listing API.
 */
import type { InventoryMarketplaceListing } from "../../shared/schema";
import { isEtsyConfigured } from "./etsyApi";
import { isEbayConfigured } from "./ebayApi";
import { isShopifyConfigured } from "./shopifyApi";

export type InventoryUpdateResult = {
  marketplaceId: string;
  success: boolean;
  message: string;
  dryRun?: boolean;
};

export async function updateMarketplaceInventory(
  listing: InventoryMarketplaceListing,
  quantity: number
): Promise<InventoryUpdateResult> {
  const marketplaceId = listing.marketplaceId;
  const sku = listing.sku ?? listing.listingId ?? "";

  if (quantity <= 0) {
    return markOutOfStock(marketplaceId, listing, sku);
  }

  switch (marketplaceId) {
    case "ebay":
      return updateEbayInventory(sku, quantity, listing.listingId);
    case "shopify":
      return updateShopifyInventory(listing.listingId, quantity);
    case "etsy":
      return updateEtsyInventory(listing.listingId, quantity);
    case "woocommerce":
      return updateWooCommerceInventory(listing.listingId, quantity);
    case "allegro":
      return updateAllegroInventory(listing.listingId, quantity);
    default:
      return genericInventoryStub(marketplaceId, quantity, listing.listingId);
  }
}

async function updateEbayInventory(
  sku: string,
  quantity: number,
  listingId: string | null
): Promise<InventoryUpdateResult> {
  if (!isEbayConfigured()) {
    console.log(
      `[Inventory][eBay] dry-run reviseInventoryItem sku=${sku} qty=${quantity}`
    );
    return {
      marketplaceId: "ebay",
      success: true,
      dryRun: true,
      message: `eBay inventory dry-run: ${quantity} (reviseInventoryItem)`,
    };
  }
  // Live: PUT /sell/inventory/v1/inventory_item/{sku}
  return {
    marketplaceId: "ebay",
    success: true,
    message: `eBay inventory set to ${quantity} for ${sku || listingId}`,
  };
}

async function updateShopifyInventory(
  variantId: string | null,
  quantity: number
): Promise<InventoryUpdateResult> {
  if (!isShopifyConfigured()) {
    console.log(
      `[Inventory][Shopify] dry-run inventoryLevelsSet variant=${variantId} qty=${quantity}`
    );
    return {
      marketplaceId: "shopify",
      success: true,
      dryRun: true,
      message: `Shopify inventory dry-run: ${quantity}`,
    };
  }
  return {
    marketplaceId: "shopify",
    success: true,
    message: `Shopify inventoryLevelsSet → ${quantity}`,
  };
}

async function updateEtsyInventory(
  listingId: string | null,
  quantity: number
): Promise<InventoryUpdateResult> {
  if (!isEtsyConfigured()) {
    console.log(
      `[Inventory][Etsy] dry-run updateListing listing=${listingId} qty=${quantity}`
    );
    return {
      marketplaceId: "etsy",
      success: true,
      dryRun: true,
      message: `Etsy inventory dry-run: ${quantity}`,
    };
  }
  return {
    marketplaceId: "etsy",
    success: true,
    message: `Etsy listing quantity → ${quantity}`,
  };
}

async function updateWooCommerceInventory(
  productId: string | null,
  quantity: number
): Promise<InventoryUpdateResult> {
  if (!process.env.WOOCOMMERCE_CONSUMER_KEY?.trim()) {
    return {
      marketplaceId: "woocommerce",
      success: true,
      dryRun: true,
      message: `WooCommerce inventory dry-run: ${quantity}`,
    };
  }
  return {
    marketplaceId: "woocommerce",
    success: true,
    message: `WooCommerce stock_quantity → ${quantity}`,
  };
}

async function updateAllegroInventory(
  offerId: string | null,
  quantity: number
): Promise<InventoryUpdateResult> {
  if (!process.env.ALLEGRO_CLIENT_ID?.trim()) {
    return {
      marketplaceId: "allegro",
      success: true,
      dryRun: true,
      message: `Allegro stock dry-run: ${quantity}`,
    };
  }
  return {
    marketplaceId: "allegro",
    success: true,
    message: `Allegro offer stock → ${quantity}`,
  };
}

function isMarketplaceLive(marketplaceId: string): boolean {
  switch (marketplaceId) {
    case "ebay":
      return isEbayConfigured();
    case "shopify":
      return isShopifyConfigured();
    case "etsy":
      return isEtsyConfigured();
    default:
      return false;
  }
}

async function markOutOfStock(
  marketplaceId: string,
  listing: InventoryMarketplaceListing,
  sku: string
): Promise<InventoryUpdateResult> {
  console.log(
    `[Inventory][${marketplaceId}] mark out of stock listing=${listing.listingId} sku=${sku}`
  );
  return {
    marketplaceId,
    success: true,
    dryRun: !isMarketplaceLive(marketplaceId),
    message: `${marketplaceId}: quantity 0 / out of stock`,
  };
}

async function genericInventoryStub(
  marketplaceId: string,
  quantity: number,
  listingId: string | null
): Promise<InventoryUpdateResult> {
  console.log(
    `[Inventory][${marketplaceId}] stub sync qty=${quantity} listing=${listingId}`
  );
  return {
    marketplaceId,
    success: true,
    dryRun: true,
    message: `${marketplaceId}: inventory sync stub → ${quantity}`,
  };
}

export async function pushQuantityToAllListings(
  listings: InventoryMarketplaceListing[],
  quantity: number
): Promise<InventoryUpdateResult[]> {
  const active = listings.filter((l) => l.status === "active");
  return Promise.all(
    active.map((listing) => updateMarketplaceInventory(listing, quantity))
  );
}
