import * as SecureStore from 'expo-secure-store';

export type StoredPlatformTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  shopId?: string;
  shopDomain?: string;
  accountName?: string;
  scope?: string;
};

function key(marketplace: string, field: string): string {
  return `oauth:${marketplace}:${field}`;
}

export async function savePlatformTokens(
  marketplace: string,
  tokens: StoredPlatformTokens
): Promise<void> {
  await SecureStore.setItemAsync(key(marketplace, 'bundle'), JSON.stringify(tokens));
}

export async function loadPlatformTokens(
  marketplace: string
): Promise<StoredPlatformTokens | null> {
  const raw = await SecureStore.getItemAsync(key(marketplace, 'bundle'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlatformTokens;
  } catch {
    return null;
  }
}

export async function deletePlatformTokens(marketplace: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(marketplace, 'bundle'));
}

export async function hasPlatformTokens(marketplace: string): Promise<boolean> {
  const tokens = await loadPlatformTokens(marketplace);
  return Boolean(tokens?.accessToken);
}

export async function saveShopDomain(shopDomain: string): Promise<void> {
  await SecureStore.setItemAsync('oauth:shopify:shopDomain', shopDomain);
}

export async function loadShopDomain(): Promise<string | null> {
  return SecureStore.getItemAsync('oauth:shopify:shopDomain');
}
