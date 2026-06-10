/**
 * Unified mobile marketplace connect adapter (Etsy, Shopify, eBay).
 * Delegates to one-tap OAuth + on-device user profile fetch.
 */
import { connectMarketplaceOneTap, oneTapHelpText } from './marketplaceOAuth';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import { getOAuthConfig } from './oauthConfig';
import { loadPlatformTokens } from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile, OAuthPlatform } from '../types/marketplaceConnect';

export type { ConnectResult, MarketplaceUserProfile, OAuthPlatform };

export { oneTapHelpText };

export async function connectPlatform(platform: OAuthPlatform, shopDomain?: string): Promise<ConnectResult> {
  return connectMarketplaceOneTap(platform, shopDomain);
}

/** Reload profile from marketplace API using stored on-device tokens. */
export async function refreshPlatformProfile(
  platform: OAuthPlatform
): Promise<MarketplaceUserProfile> {
  const tokens = await loadPlatformTokens(platform);
  if (!tokens) throw new Error(`${platform} not connected`);
  const config = await getOAuthConfig(platform);
  if (!config) throw new Error('OAuth config unavailable');
  return fetchMarketplaceUserProfile(platform, config, tokens);
}
