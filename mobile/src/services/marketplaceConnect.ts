/**
 * Unified mobile marketplace connect adapter — all OAuth marketplaces.
 */
import { connectMarketplaceOneTap, oneTapHelpText } from './unifiedMarketplaceOAuth';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import { getOAuthProvider } from './oauthConfig';
import { loadConnectContext, loadPlatformTokens } from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile } from '../types/marketplaceConnect';

export type { ConnectResult, MarketplaceUserProfile };
export { oneTapHelpText };

export async function connectPlatform(
  marketplaceId: string,
  options?: { shopDomain?: string; siteUrl?: string; baseUrl?: string }
): Promise<ConnectResult> {
  return connectMarketplaceOneTap(marketplaceId, options);
}

export async function refreshPlatformProfile(
  marketplaceId: string
): Promise<MarketplaceUserProfile> {
  const tokens = await loadPlatformTokens(marketplaceId);
  if (!tokens) throw new Error(`${marketplaceId} not connected`);
  const config = await getOAuthProvider(marketplaceId);
  if (!config) throw new Error('OAuth config unavailable');
  const ctx = (await loadConnectContext(marketplaceId)) ?? {};
  return fetchMarketplaceUserProfile(marketplaceId, config, tokens, ctx);
}
