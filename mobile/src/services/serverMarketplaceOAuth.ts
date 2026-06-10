/**
 * Server-side universal OAuth connect for Etsy, eBay, Shopify, and Amazon.
 */
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from './config';

export type ServerOAuthConnection = {
  marketplace: string;
  provider?: string;
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
  shopDomain: string | null;
};

const SERVER_OAUTH_IDS = new Set(['etsy', 'ebay', 'shopify', 'amazon']);

export function usesServerOAuth(marketplaceId: string): boolean {
  return SERVER_OAUTH_IDS.has(marketplaceId);
}

export async function fetchServerOAuthConnections(): Promise<ServerOAuthConnection[]> {
  const res = await fetch(`${API_BASE_URL}/api/auth/connections`);
  if (!res.ok) {
    throw new Error('Failed to load server OAuth connections');
  }
  const data = (await res.json()) as { connections?: ServerOAuthConnection[] };
  return data.connections ?? [];
}

export async function connectMarketplaceViaServer(
  marketplaceId: string,
  options?: { shopDomain?: string }
): Promise<{ ok: boolean; message: string }> {
  if (!usesServerOAuth(marketplaceId)) {
    throw new Error(`${marketplaceId} does not use server OAuth`);
  }

  const params = new URLSearchParams({ returnTo: 'mobile', redirect: '1' });
  if (options?.shopDomain?.trim()) {
    params.set('shop', options.shopDomain.trim());
  }

  const authUrl = `${API_BASE_URL}/api/auth/${marketplaceId}/url?${params.toString()}`;
  const redirectUrl = `kauf26://oauth/${marketplaceId}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === 'success' && result.url) {
    const parsed = new URL(result.url);
    const connected = parsed.searchParams.get('connected');
    if (connected === '1' || connected === 'true') {
      return { ok: true, message: 'Account linked successfully.' };
    }
    const reason = parsed.searchParams.get('reason') ?? 'Connection failed';
    return { ok: false, message: reason };
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Connection cancelled');
  }

  throw new Error('OAuth failed — try again');
}

export async function disconnectMarketplaceViaServer(marketplaceId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/${marketplaceId}/revoke`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to disconnect');
  }
}
