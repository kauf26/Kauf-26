import { API_BASE_URL, apiRequest } from './api';

export type MarketplaceOAuthConfig = {
  marketplace: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  requiresShopDomain?: boolean;
};

export async function fetchOAuthConfigs(): Promise<MarketplaceOAuthConfig[]> {
  const res = await apiRequest<{ marketplaces: MarketplaceOAuthConfig[] }>(
    '/api/marketplaces/oauth-config'
  );
  return res.marketplaces ?? [];
}

export async function getOAuthConfig(
  marketplace: string
): Promise<MarketplaceOAuthConfig | undefined> {
  const configs = await fetchOAuthConfigs();
  return configs.find((c) => c.marketplace === marketplace);
}

/** Shopify/eBay token exchange requires app secret compiled into the mobile build. */
export function getMobileClientSecret(marketplace: 'shopify' | 'ebay'): string {
  if (marketplace === 'shopify') {
    return process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET ?? '';
  }
  return process.env.EXPO_PUBLIC_EBAY_CLIENT_SECRET ?? '';
}
