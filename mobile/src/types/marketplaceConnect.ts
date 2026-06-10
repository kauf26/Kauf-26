import type { MarketplaceOAuthFlow } from '../../../shared/marketplaceOAuthTypes';

export type OAuthPlatform = string;

/** Profile fields fetched from a marketplace API after OAuth (device-only). */
export type MarketplaceUserProfile = {
  marketplace: string;
  name?: string;
  email?: string;
  accountLabel?: string;
  userId?: string;
  shopId?: string;
};

export type ConnectResult = {
  marketplace: string;
  oneTapLikely: boolean;
  profile: MarketplaceUserProfile;
};

export type ProviderDisplayMeta = {
  id: string;
  name: string;
  color: string;
  oauthSupported: boolean;
  oauthFlow?: MarketplaceOAuthFlow;
  configured: boolean;
  requiresShopDomain?: boolean;
  requiresSiteUrl?: boolean;
  requiresBaseUrl?: boolean;
  notes?: string;
};
