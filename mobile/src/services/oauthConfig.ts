import { apiRequest } from './api';
import { getOAuthManifestEntry } from '../../../shared/marketplaceOAuthManifest';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';

export type { MarketplaceOAuthProviderConfig };

export type OAuthConfigResponse = {
  providers: MarketplaceOAuthProviderConfig[];
  configured: MarketplaceOAuthProviderConfig[];
  /** @deprecated */
  marketplaces?: Array<{
    marketplace: string;
    clientId: string;
    scopes: string;
    redirectUri: string;
    authorizeUrl: string;
    tokenUrl: string;
    requiresShopDomain?: boolean;
  }>;
};

let cachedProviders: MarketplaceOAuthProviderConfig[] | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export async function fetchOAuthProviders(): Promise<MarketplaceOAuthProviderConfig[]> {
  if (cachedProviders && Date.now() - cacheAt < CACHE_MS) {
    return cachedProviders;
  }
  const res = await apiRequest<OAuthConfigResponse>('/api/marketplaces/oauth-config');
  cachedProviders = res.providers ?? [];
  cacheAt = Date.now();
  return cachedProviders;
}

export async function getOAuthProvider(
  marketplaceId: string
): Promise<MarketplaceOAuthProviderConfig | undefined> {
  const providers = await fetchOAuthProviders();
  return providers.find((p) => p.id === marketplaceId);
}

/** @deprecated Legacy shape for marketplaceClients */
export async function fetchOAuthConfigs() {
  const res = await apiRequest<OAuthConfigResponse>('/api/marketplaces/oauth-config');
  const list = res.configured ?? [];
  return list.map((p) => ({
    marketplace: p.id,
    clientId: p.clientId,
    scopes: p.scopes.join(' '),
    redirectUri: p.redirectUri,
    authorizeUrl: p.authUrl,
    tokenUrl: p.tokenUrl,
    requiresShopDomain: p.requiresShopDomain,
  }));
}

/** @deprecated */
export async function getOAuthConfig(marketplace: string) {
  const legacy = await fetchOAuthConfigs();
  return legacy.find((c) => c.marketplace === marketplace);
}

/** On-device token exchange secret from Expo build env. */
export function getMobileClientSecret(marketplaceId: string): string {
  const entry = getOAuthManifestEntry(marketplaceId);
  if (entry?.mobileClientSecretEnv) {
    return process.env[entry.mobileClientSecretEnv] ?? '';
  }
  const derived = `EXPO_PUBLIC_${marketplaceId.toUpperCase()}_CLIENT_SECRET`;
  return process.env[derived] ?? '';
}
