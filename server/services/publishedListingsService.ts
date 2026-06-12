import { db } from "../db";
import {
  inventoryMarketplaceListings,
  inventoryPools,
  listings,
  productDrafts,
  products,
} from "../../shared/schema";
import {
  resolvePublishedListingUrl,
  type PublishedListing,
} from "../../shared/publishedListings";
import { desc, eq } from "drizzle-orm";

function productThumbnail(
  imageUrl: string | null | undefined,
  additionalImages: string[] | null | undefined
): string | null {
  if (imageUrl?.trim()) return imageUrl.trim();
  const first = additionalImages?.find((url) => typeof url === "string" && url.trim());
  return first?.trim() ?? null;
}

function draftThumbnail(draft: {
  images?: unknown;
  attributes?: unknown;
}): string | null {
  const images = Array.isArray(draft.images) ? draft.images : [];
  const firstImage = images.find((url) => typeof url === "string" && url.trim());
  if (typeof firstImage === "string") return firstImage.trim();

  const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
  if (typeof attrs.capturedImage === "string" && attrs.capturedImage.trim()) {
    return attrs.capturedImage.trim();
  }
  return null;
}

function draftPrice(attributes: unknown): { price: string; currency: string } {
  const attrs = (attributes ?? {}) as Record<string, unknown>;
  const marketPrices = (attrs.marketPrices ?? {}) as Record<string, unknown>;
  return {
    price: String(
      attrs.recommendedPrice ??
        marketPrices.recommendedPrice ??
        attrs.medianPrice ??
        attrs.price ??
        "0.00"
    ),
    currency: String(attrs.currency ?? "USD"),
  };
}

function defaultShopDomain(): string | null {
  return (
    process.env.SHOPIFY_SHOP_DOMAIN?.trim() ||
    process.env.SHOPIFY_STORE_DOMAIN?.trim() ||
    process.env.SHOPIFY_APP_BASE_URL?.replace(/^https?:\/\//i, "").split("/")[0] ||
    null
  );
}

export async function fetchPublishedListings(): Promise<PublishedListing[]> {
  const ebaySandbox = process.env.EBAY_SANDBOX === "true";
  const shopDomain = defaultShopDomain();
  const published: PublishedListing[] = [];

  const legacyRows = await db
    .select({
      id: listings.id,
      marketplace: listings.marketplace,
      status: listings.status,
      productId: listings.productId,
      translatedTitle: listings.translatedTitle,
      marketplaceListingId: listings.marketplaceListingId,
      ebayItemId: listings.ebayItemId,
      localPrice: listings.localPrice,
      localCurrency: listings.localCurrency,
      createdAt: listings.createdAt,
      productName: products.name,
      productImageUrl: products.imageUrl,
      productAdditionalImages: products.additionalImages,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .orderBy(desc(listings.createdAt));

  for (const row of legacyRows) {
    const listingUrl = resolvePublishedListingUrl({
      marketplace: row.marketplace,
      marketplaceListingId: row.marketplaceListingId,
      ebayItemId: row.ebayItemId,
      shopDomain,
      sandbox: ebaySandbox,
    });

    published.push({
      id: row.id,
      title: row.translatedTitle?.trim() || row.productName,
      price: String(row.localPrice ?? "0.00"),
      currency: row.localCurrency ?? "USD",
      imageUrl: productThumbnail(row.productImageUrl, row.productAdditionalImages),
      marketplace: row.marketplace,
      status: row.status,
      marketplaceListingId: row.marketplaceListingId ?? null,
      listingUrl,
      productId: row.productId,
      draftId: null,
      createdAt: row.createdAt?.toString?.() ?? new Date().toISOString(),
    });
  }

  const inventoryRows = await db
    .select({
      id: inventoryMarketplaceListings.id,
      marketplace: inventoryMarketplaceListings.marketplaceId,
      status: inventoryMarketplaceListings.status,
      marketplaceListingId: inventoryMarketplaceListings.listingId,
      updatedAt: inventoryMarketplaceListings.updatedAt,
      draftId: inventoryPools.draftId,
      draftTitle: productDrafts.title,
      draftImages: productDrafts.images,
      draftAttributes: productDrafts.attributes,
    })
    .from(inventoryMarketplaceListings)
    .innerJoin(inventoryPools, eq(inventoryMarketplaceListings.poolId, inventoryPools.id))
    .innerJoin(productDrafts, eq(inventoryPools.draftId, productDrafts.id))
    .orderBy(desc(inventoryMarketplaceListings.updatedAt));

  for (const row of inventoryRows) {
    if (!row.marketplaceListingId?.trim()) continue;

    const { price, currency } = draftPrice(row.draftAttributes);
    const listingUrl = resolvePublishedListingUrl({
      marketplace: row.marketplace,
      marketplaceListingId: row.marketplaceListingId,
      shopDomain,
      sandbox: ebaySandbox,
    });

    published.push({
      id: 1_000_000 + row.id,
      title: row.draftTitle?.trim() || "Untitled listing",
      price,
      currency,
      imageUrl: draftThumbnail({
        images: row.draftImages,
        attributes: row.draftAttributes,
      }),
      marketplace: row.marketplace,
      status: row.status,
      marketplaceListingId: row.marketplaceListingId,
      listingUrl,
      productId: null,
      draftId: row.draftId,
      createdAt: row.updatedAt?.toString?.() ?? new Date().toISOString(),
    });
  }

  published.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return published;
}
