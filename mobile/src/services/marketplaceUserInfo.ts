/**
 * Fetch seller identity from marketplace APIs using device-stored tokens.
 */
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import type { UserInfoFieldMapping } from '../../../shared/marketplaceOAuthTypes';
import type { MarketplaceUserProfile } from '../types/marketplaceConnect';
import type { ConnectContext, StoredPlatformTokens } from './secureTokenStore';

function pickName(...parts: (string | undefined | null)[]): string | undefined {
  const s = parts.map((p) => String(p ?? '').trim()).filter(Boolean).join(' ').trim();
  return s || undefined;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function mapProfileFromJson(
  marketplace: string,
  json: unknown,
  mapping?: UserInfoFieldMapping
): MarketplaceUserProfile {
  const read = (paths?: string[]) => {
    if (!paths?.length) return undefined;
    const values = paths
      .map((p) => getByPath(json, p))
      .filter((v) => v != null && String(v).trim())
      .map((v) => String(v).trim());
    return paths.length > 1 && !paths[0].includes('.')
      ? pickName(...values)
      : values[0];
  };

  return {
    marketplace,
    name: read(mapping?.name),
    email: read(mapping?.email),
    userId: read(mapping?.userId),
    accountLabel: read(mapping?.accountLabel) ?? read(mapping?.name),
  };
}

function authHeaders(
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens
): Record<string, string> {
  switch (config.userInfoAuth) {
    case 'etsy':
      return {
        'x-api-key': config.clientId,
        Authorization: `Bearer ${tokens.accessToken}`,
      };
    case 'shopify':
      return {
        'X-Shopify-Access-Token': tokens.accessToken,
        Accept: 'application/json',
      };
    case 'ebay':
      return {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
      };
    case 'bearer':
      return {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
      };
    default:
      return { Accept: 'application/json' };
  }
}

async function fetchEtsyProfile(
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  const headers = authHeaders(config, tokens);
  const meRes = await fetch('https://api.etsy.com/v3/application/users/me', { headers });
  if (!meRes.ok) throw new Error(`Etsy profile fetch failed (${meRes.status})`);
  const me = (await meRes.json()) as { user_id?: number; shop_id?: number };
  const userId = me.user_id != null ? String(me.user_id) : tokens.userId;
  let profile = mapProfileFromJson('etsy', me, config.userInfoMapping);

  if (userId) {
    const userRes = await fetch(`https://api.etsy.com/v3/application/users/${userId}`, { headers });
    if (userRes.ok) {
      const user = await userRes.json();
      profile = {
        ...profile,
        ...mapProfileFromJson('etsy', user, {
          name: ['first_name', 'last_name'],
          email: ['primary_email'],
          userId: ['user_id'],
          accountLabel: ['login_name'],
        }),
      };
    }
  }

  const shopId = me.shop_id != null ? String(me.shop_id) : tokens.shopId;
  if (shopId) {
    const shopRes = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}`, { headers });
    if (shopRes.ok) {
      const shop = (await shopRes.json()) as { shop_name?: string };
      profile.shopId = shopId;
      profile.accountLabel = shop.shop_name ?? profile.accountLabel;
      if (!profile.name) profile.name = shop.shop_name;
    }
  }

  profile.userId = userId;
  profile.accountLabel = profile.accountLabel ?? profile.name ?? `Etsy user ${userId ?? ''}`.trim();
  return profile;
}

async function fetchShopifyProfile(
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens,
  ctx: ConnectContext
): Promise<MarketplaceUserProfile> {
  const shop = ctx.shopDomain ?? tokens.shopDomain;
  if (!shop) throw new Error('Shopify shop domain missing');
  const url = config.userInfoUrl.replace('{shop}', shop);
  const res = await fetch(url.startsWith('http') ? url : `https://${shop}/admin/api/2024-10/shop.json`, {
    headers: authHeaders(config, tokens),
  });
  if (!res.ok) throw new Error(`Shopify profile fetch failed (${res.status})`);
  const json = await res.json();
  const profile = mapProfileFromJson('shopify', json, config.userInfoMapping);
  return {
    ...profile,
    accountLabel: profile.accountLabel ?? shop,
  };
}

async function fetchEbayProfile(
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  const sandbox = config.tokenUrl.includes('sandbox');
  const base = sandbox ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com';
  const res = await fetch(`${base}/commerce/identity/v1/user/`, {
    headers: authHeaders(config, tokens),
  });
  if (!res.ok) throw new Error(`eBay profile fetch failed (${res.status})`);
  const json = await res.json();
  const profile = mapProfileFromJson('ebay', json, {
    name: ['individualAccount.firstName', 'individualAccount.lastName'],
    email: ['individualAccount.email'],
    accountLabel: ['username'],
  });
  return {
    ...profile,
    name: profile.name ?? (json as { username?: string }).username,
    accountLabel: profile.accountLabel ?? 'eBay seller',
  };
}

async function fetchGenericProfile(
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens,
  ctx: ConnectContext
): Promise<MarketplaceUserProfile> {
  if (!config.userInfoUrl?.trim()) {
    return {
      marketplace: config.id,
      accountLabel: tokens.accountName ?? config.name,
      name: tokens.userName,
      email: tokens.userEmail,
    };
  }

  let url = config.userInfoUrl
    .replace('{shop}', ctx.shopDomain ?? tokens.shopDomain ?? '')
    .replace('{site}', ctx.siteUrl ?? '')
    .replace('{base}', ctx.baseUrl ?? '');

  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }

  const res = await fetch(url, { headers: authHeaders(config, tokens) });
  if (!res.ok) {
    return {
      marketplace: config.id,
      accountLabel: tokens.accountName ?? config.name,
    };
  }
  const json = await res.json();
  const profile = mapProfileFromJson(config.id, json, config.userInfoMapping);
  return {
    ...profile,
    accountLabel: profile.accountLabel ?? profile.name ?? config.name,
  };
}

export async function fetchMarketplaceUserProfile(
  marketplace: string,
  config: MarketplaceOAuthProviderConfig,
  tokens: StoredPlatformTokens,
  ctx: ConnectContext = {}
): Promise<MarketplaceUserProfile> {
  switch (marketplace) {
    case 'etsy':
      return fetchEtsyProfile(config, tokens);
    case 'shopify':
      return fetchShopifyProfile(config, tokens, ctx);
    case 'ebay':
      return fetchEbayProfile(config, tokens);
    default:
      return fetchGenericProfile(config, tokens, ctx);
  }
}

/** @deprecated */
export async function fetchMarketplaceUserProfileLegacy(
  marketplace: 'etsy' | 'shopify' | 'ebay',
  config: { clientId: string; tokenUrl: string },
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  return fetchMarketplaceUserProfile(
    marketplace,
    {
      id: marketplace,
      name: marketplace,
      authUrl: '',
      tokenUrl: config.tokenUrl,
      userInfoUrl: '',
      clientId: config.clientId,
      scopes: [],
      redirectUri: '',
      oauthFlow: 'authorization_code_secret',
      oauthSupported: true,
      tokenExchange: 'form_secret',
      userInfoAuth: 'bearer',
      configured: true,
    },
    tokens
  );
}
