export type OAuthPlatform = 'etsy' | 'shopify' | 'ebay';

/** Profile fields fetched from a marketplace API after OAuth (device-only). */
export type MarketplaceUserProfile = {
  marketplace: OAuthPlatform;
  name?: string;
  email?: string;
  accountLabel?: string;
  userId?: string;
  shopId?: string;
};

export type ConnectResult = {
  marketplace: OAuthPlatform;
  oneTapLikely: boolean;
  profile: MarketplaceUserProfile;
};
