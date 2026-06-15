/**
 * Device-side marketplace connection helpers.
 * The server never stores marketplace OAuth tokens.
 */
import { getOAuthManifestEntry } from '../../../shared/marketplaceOAuthManifest';
import {
  hasPlatformTokens,
  loadPlatformTokens,
} from './secureTokenStore';

export function usesServerOAuth(_marketplaceId: string): boolean {
  return false;
}

export function isDeviceOAuthMarketplace(marketplaceId: string): boolean {
  return Boolean(getOAuthManifestEntry(marketplaceId)?.oauthSupported);
}

export async function fetchServerOAuthConnections(): Promise<
  Array<{
    marketplace: string;
    configured: boolean;
    connected: boolean;
    accountLabel: string | null;
    shopDomain: string | null;
  }>
> {
  return [];
}

export async function fetchDeviceOAuthStatus(marketplaceId: string): Promise<{
  connected: boolean;
  accountLabel: string | null;
  shopDomain: string | null;
  message: string;
}> {
  const connected = await hasPlatformTokens(marketplaceId);
  if (!connected) {
    return {
      connected: false,
      accountLabel: null,
      shopDomain: null,
      message: 'Not connected',
    };
  }
  const tokens = await loadPlatformTokens(marketplaceId);
  return {
    connected: true,
    accountLabel: tokens?.userName ?? tokens?.accountName ?? null,
    shopDomain: tokens?.shopDomain ?? null,
    message: tokens?.userName ?? tokens?.accountName ?? 'Connected',
  };
}

export async function disconnectMarketplaceOnDevice(marketplaceId: string): Promise<void> {
  const { deletePlatformTokens } = await import('./secureTokenStore');
  await deletePlatformTokens(marketplaceId);
}

/** @deprecated Server does not store OAuth tokens */
export const disconnectMarketplaceViaServer = disconnectMarketplaceOnDevice;

/** @deprecated Use connectMarketplaceOneTap — tokens stay on device */
export async function connectMarketplaceViaServer(): Promise<never> {
  throw new Error('Server OAuth storage is disabled — connect on this device instead.');
}
