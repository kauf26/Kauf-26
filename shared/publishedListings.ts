import { buildMarketplaceListingUrl } from "./marketplaceListingUrl";

export type PublishedListing = {
  id: number;
  title: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  marketplace: string;
  status: string;
  marketplaceListingId: string | null;
  listingUrl: string | null;
  productId: number | null;
  draftId: number | null;
  createdAt: string;
};

export function resolvePublishedListingUrl(input: {
  marketplace: string;
  marketplaceListingId?: string | null;
  ebayItemId?: string | null;
  listingUrl?: string | null;
  shopDomain?: string | null;
  sandbox?: boolean;
}): string | null {
  if (input.listingUrl?.trim()) {
    return input.listingUrl.trim();
  }

  const listingId =
    input.marketplaceListingId?.trim() ||
    input.ebayItemId?.trim() ||
    null;

  return buildMarketplaceListingUrl(input.marketplace, listingId, {
    shopDomain: input.shopDomain,
    sandbox: input.sandbox,
  });
}
