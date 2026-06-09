import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  getMobileClientSecret,
  getOAuthConfig,
  type MarketplaceOAuthConfig,
} from './oauthConfig';
import {
  loadShopDomain,
  savePlatformTokens,
  saveShopDomain,
  type StoredPlatformTokens,
} from './secureTokenStore';

WebBrowser.maybeCompleteAuthSession();

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (!cleaned) throw new Error('Shop domain required');
  return cleaned.includes('.') ? cleaned : `${cleaned}.myshopify.com`;
}

async function exchangeEtsyCode(
  config: MarketplaceOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<StoredPlatformTokens> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? 'Etsy token exchange failed');
  }
  const userId = String(json.access_token ?? '').split('.')[0];
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    userId,
    scope: json.scope,
  } as StoredPlatformTokens & { userId?: string };
}

async function exchangeShopifyCode(
  config: MarketplaceOAuthConfig,
  shopDomain: string,
  code: string
): Promise<StoredPlatformTokens> {
  const secret = getMobileClientSecret('shopify');
  if (!secret) {
    throw new Error('Set EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET in mobile build config');
  }
  const shop = normalizeShop(shopDomain);
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: secret,
      code,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? 'Shopify token exchange failed');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? '',
    expiresAt: Date.now() + (json.expires_in ?? 86399) * 1000,
    shopDomain: shop,
    accountName: shop,
    scope: json.scope,
  };
}

async function exchangeEbayCode(
  config: MarketplaceOAuthConfig,
  code: string
): Promise<StoredPlatformTokens> {
  const secret = getMobileClientSecret('ebay');
  if (!secret) {
    throw new Error('Set EXPO_PUBLIC_EBAY_CLIENT_SECRET in mobile build config');
  }
  const basic = btoa(`${config.clientId}:${secret}`);
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? 'eBay token exchange failed');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
    accountName: 'eBay seller',
    scope: json.scope,
  };
}

export async function connectMarketplace(
  marketplace: 'etsy' | 'shopify' | 'ebay',
  shopDomain?: string
): Promise<void> {
  const config = await getOAuthConfig(marketplace);
  if (!config) {
    throw new Error(`${marketplace} OAuth is not configured on the server`);
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'kauf26',
    path: `oauth/${marketplace}`,
  });

  if (marketplace === 'shopify') {
    if (!shopDomain?.trim()) throw new Error('Enter your Shopify store domain first');
    await saveShopDomain(normalizeShop(shopDomain));
  }

  const usePkce = marketplace === 'etsy';

  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes.split(/[\s,]+/).filter(Boolean),
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: usePkce,
  });

  let authorizeUrl = config.authorizeUrl;
  if (marketplace === 'shopify') {
    const shop = normalizeShop(shopDomain!);
    authorizeUrl = `https://${shop}/admin/oauth/authorize`;
  }

  const discovery = {
    authorizationEndpoint: authorizeUrl,
    tokenEndpoint: config.tokenUrl,
  };

  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params.code) {
    throw new Error(result.type === 'cancel' ? 'OAuth cancelled' : 'OAuth failed');
  }

  let tokens: StoredPlatformTokens;
  if (marketplace === 'etsy') {
    tokens = await exchangeEtsyCode(config, result.params.code, request.codeVerifier ?? '');
    try {
      const meRes = await fetch('https://api.etsy.com/v3/application/users/me', {
        headers: {
          'x-api-key': config.clientId,
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.shop_id) tokens.shopId = String(me.shop_id);
      }
    } catch {
      /* shop id optional at connect time */
    }
  } else if (marketplace === 'shopify') {
    tokens = await exchangeShopifyCode(config, shopDomain!, result.params.code);
  } else {
    tokens = await exchangeEbayCode(config, result.params.code);
  }

  await savePlatformTokens(marketplace, tokens);
}
