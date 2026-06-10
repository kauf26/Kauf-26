/**
 * Fetch seller identity from each marketplace API using device-stored tokens.
 * Called immediately after OAuth so onboarding name/email can auto-fill.
 */
import type { MarketplaceOAuthConfig } from './oauthConfig';
import type { MarketplaceUserProfile, OAuthPlatform } from '../types/marketplaceConnect';
import type { StoredPlatformTokens } from './secureTokenStore';

function pickName(...parts: (string | undefined | null)[]): string | undefined {
  const s = parts.map((p) => String(p ?? '').trim()).filter(Boolean).join(' ').trim();
  return s || undefined;
}

export async function fetchEtsyUserProfile(
  config: MarketplaceOAuthConfig,
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  const headers = {
    'x-api-key': config.clientId,
    Authorization: `Bearer ${tokens.accessToken}`,
  };

  const meRes = await fetch('https://api.etsy.com/v3/application/users/me', { headers });
  if (!meRes.ok) {
    throw new Error(`Etsy profile fetch failed (${meRes.status})`);
  }
  const me = (await meRes.json()) as { user_id?: number; shop_id?: number };
  const userId = me.user_id != null ? String(me.user_id) : tokens.userId;
  let name: string | undefined;
  let email: string | undefined;
  let shopName: string | undefined;

  if (userId) {
    const userRes = await fetch(`https://api.etsy.com/v3/application/users/${userId}`, {
      headers,
    });
    if (userRes.ok) {
      const user = (await userRes.json()) as {
        first_name?: string;
        last_name?: string;
        primary_email?: string;
        login_name?: string;
      };
      name = pickName(user.first_name, user.last_name) ?? user.login_name;
      email = user.primary_email;
    }
  }

  const shopId = me.shop_id != null ? String(me.shop_id) : tokens.shopId;
  if (shopId) {
    const shopRes = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}`, {
      headers,
    });
    if (shopRes.ok) {
      const shop = (await shopRes.json()) as { shop_name?: string };
      shopName = shop.shop_name;
      if (!name) name = shop.shop_name;
    }
  }

  return {
    marketplace: 'etsy',
    userId,
    shopId,
    name,
    email,
    accountLabel: shopName ?? name ?? `Etsy user ${userId ?? ''}`.trim(),
  };
}

export async function fetchShopifyUserProfile(
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  const shop = tokens.shopDomain;
  if (!shop) throw new Error('Shopify shop domain missing');

  const res = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': tokens.accessToken,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Shopify profile fetch failed (${res.status})`);
  const json = (await res.json()) as {
    shop?: { name?: string; email?: string; shop_owner?: string; myshopify_domain?: string };
  };
  const shopData = json.shop;
  return {
    marketplace: 'shopify',
    name: shopData?.shop_owner ?? shopData?.name,
    email: shopData?.email,
    accountLabel: shopData?.name ?? shop,
  };
}

export async function fetchEbayUserProfile(
  tokens: StoredPlatformTokens,
  sandbox: boolean
): Promise<MarketplaceUserProfile> {
  const base = sandbox
    ? 'https://apiz.sandbox.ebay.com'
    : 'https://apiz.ebay.com';

  const res = await fetch(`${base}/commerce/identity/v1/user/`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`eBay profile fetch failed (${res.status})`);
  const json = (await res.json()) as {
    username?: string;
    accountType?: string;
    individualAccount?: { email?: string; firstName?: string; lastName?: string };
  };

  const name =
    pickName(json.individualAccount?.firstName, json.individualAccount?.lastName) ??
    json.username;
  const email = json.individualAccount?.email;

  return {
    marketplace: 'ebay',
    name,
    email,
    accountLabel: json.username ?? name ?? 'eBay seller',
  };
}

export async function fetchMarketplaceUserProfile(
  marketplace: OAuthPlatform,
  config: MarketplaceOAuthConfig,
  tokens: StoredPlatformTokens
): Promise<MarketplaceUserProfile> {
  switch (marketplace) {
    case 'etsy':
      return fetchEtsyUserProfile(config, tokens);
    case 'shopify':
      return fetchShopifyUserProfile(tokens);
    case 'ebay':
      return fetchEbayUserProfile(tokens, config.tokenUrl.includes('sandbox'));
    default:
      throw new Error(`Unsupported marketplace: ${marketplace}`);
  }
}
