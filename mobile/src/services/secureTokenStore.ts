import * as SecureStore from 'expo-secure-store';

export type StoredPlatformTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  shopId?: string;
  shopDomain?: string;
  userId?: string;
  accountName?: string;
  userName?: string;
  userEmail?: string;
  scope?: string;
};

function key(marketplace: string, field: string): string {
  return `oauth_${marketplace}_${field}`;
}

function legacyKey(marketplace: string, field: string): string {
  return `oauth:${marketplace}:${field}`;
}

async function readSecureItem(
  storageKey: string,
  legacyStorageKey?: string
): Promise<string | null> {
  let raw = await SecureStore.getItemAsync(storageKey);
  if (!raw && legacyStorageKey) {
    try {
      raw = await SecureStore.getItemAsync(legacyStorageKey);
      if (raw) {
        await SecureStore.setItemAsync(storageKey, raw);
        try {
          await SecureStore.deleteItemAsync(legacyStorageKey);
        } catch {
          // Best-effort cleanup of legacy key
        }
      }
    } catch {
      // Legacy key format was invalid on this platform
    }
  }
  return raw;
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
  const raw = await readSecureItem(
    key(marketplace, 'bundle'),
    legacyKey(marketplace, 'bundle')
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlatformTokens;
  } catch {
    return null;
  }
}

export async function deletePlatformTokens(marketplace: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(marketplace, 'bundle'));
  try {
    await SecureStore.deleteItemAsync(legacyKey(marketplace, 'bundle'));
  } catch {
    // Legacy key format was invalid on this platform
  }
  try {
    await SecureStore.deleteItemAsync(key(marketplace, 'connectContext'));
  } catch {
    // Optional connect context
  }
}

/** Remove all marketplace OAuth tokens from device (logout / account deletion). */
export async function clearAllMarketplaceTokens(marketplaceIds: string[]): Promise<void> {
  for (const id of marketplaceIds) {
    await deletePlatformTokens(id);
  }
  try {
    await SecureStore.deleteItemAsync(SHOPIFY_SHOP_DOMAIN_KEY);
  } catch {
    // Optional
  }
}

export async function hasPlatformTokens(marketplace: string): Promise<boolean> {
  const tokens = await loadPlatformTokens(marketplace);
  return Boolean(tokens?.accessToken);
}

const SHOPIFY_SHOP_DOMAIN_KEY = key('shopify', 'shopDomain');

export async function saveShopDomain(shopDomain: string): Promise<void> {
  await SecureStore.setItemAsync(SHOPIFY_SHOP_DOMAIN_KEY, shopDomain);
}

export async function loadShopDomain(): Promise<string | null> {
  return readSecureItem(SHOPIFY_SHOP_DOMAIN_KEY, legacyKey('shopify', 'shopDomain'));
}

export type ConnectContext = {
  shopDomain?: string;
  siteUrl?: string;
  baseUrl?: string;
};

export async function saveConnectContext(
  marketplace: string,
  ctx: ConnectContext
): Promise<void> {
  await SecureStore.setItemAsync(key(marketplace, 'connectContext'), JSON.stringify(ctx));
}

export async function loadConnectContext(marketplace: string): Promise<ConnectContext | null> {
  const raw = await readSecureItem(
    key(marketplace, 'connectContext'),
    legacyKey(marketplace, 'connectContext')
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConnectContext;
  } catch {
    return null;
  }
}
