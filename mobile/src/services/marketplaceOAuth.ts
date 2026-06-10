/**
 * One-tap OAuth for Etsy, Shopify, and eBay.
 *
 * iOS: AuthSession.promptAsync → ASWebAuthenticationSession (shared Safari / iCloud Keychain cookies).
 * Android: Chrome Custom Tabs via expo-web-browser (saved passwords & active Chrome sessions).
 *
 * preferEphemeralSession: false keeps the non-ephemeral session so existing logins can authorize
 * without re-entering credentials. If the user has no saved session, they see the normal OAuth login.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { assertRedirectUriMatches } from '../../../shared/oauthRedirect';
import { openSystemBrowserOAuth } from './systemBrowserOAuth';
import {
  getMobileClientSecret,
  getOAuthConfig,
  type MarketplaceOAuthConfig,
} from './oauthConfig';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import {
  loadShopDomain,
  savePlatformTokens,
  saveShopDomain,
  type StoredPlatformTokens,
} from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile, OAuthPlatform } from '../types/marketplaceConnect';

export { getOAuthRedirectUri, OAUTH_REDIRECT_URIS } from './oauthRedirect';

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (!cleaned) throw new Error('Shop domain required');
  return cleaned.includes('.') ? cleaned : `${cleaned}.myshopify.com`;
}

function resolveRedirectUri(config: MarketplaceOAuthConfig, marketplace: OAuthPlatform): string {
  return assertRedirectUriMatches(marketplace, config.redirectUri);
}

async function exchangeEtsyCode(
  config: MarketplaceOAuthConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string
): Promise<StoredPlatformTokens> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
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
  };
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
  redirectUri: string,
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
      redirect_uri: redirectUri,
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

function mergeProfileIntoTokens(
  tokens: StoredPlatformTokens,
  profile: MarketplaceUserProfile
): StoredPlatformTokens {
  return {
    ...tokens,
    shopId: profile.shopId ?? tokens.shopId,
    userId: profile.userId ?? tokens.userId,
    accountName: profile.accountLabel ?? tokens.accountName,
    userName: profile.name,
    userEmail: profile.email,
  };
}

/**
 * Opens the system browser OAuth sheet (one-tap when Safari/Chrome already has a session).
 * Tokens + profile stay on-device only.
 */
export async function connectMarketplaceOneTap(
  marketplace: OAuthPlatform,
  shopDomain?: string
): Promise<ConnectResult> {
  const config = await getOAuthConfig(marketplace);
  if (!config) {
    throw new Error(`${marketplace} OAuth is not configured on the server`);
  }

  const redirectUri = resolveRedirectUri(config, marketplace);

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
    authorizeUrl = `https://${normalizeShop(shopDomain!)}/admin/oauth/authorize`;
  }

  const discovery = {
    authorizationEndpoint: authorizeUrl,
    tokenEndpoint: config.tokenUrl,
  };

  const { code, elapsedMs: oauthElapsedMs } = await openSystemBrowserOAuth(request, discovery);

  let tokens: StoredPlatformTokens;
  if (marketplace === 'etsy') {
    tokens = await exchangeEtsyCode(
      config,
      redirectUri,
      code,
      request.codeVerifier ?? ''
    );
  } else if (marketplace === 'shopify') {
    tokens = await exchangeShopifyCode(config, shopDomain!, code);
  } else {
    tokens = await exchangeEbayCode(config, redirectUri, code);
  }

  const profile = await fetchMarketplaceUserProfile(marketplace, config, tokens);
  tokens = mergeProfileIntoTokens(tokens, profile);
  await savePlatformTokens(marketplace, tokens);

  return {
    marketplace,
    // Short OAuth round-trip usually means Safari/Chrome reused an existing session (one-tap).
    oneTapLikely: oauthElapsedMs < 8000,
    profile,
  };
}

/** @deprecated Use connectMarketplaceOneTap */
export async function connectMarketplace(
  marketplace: OAuthPlatform,
  shopDomain?: string
): Promise<void> {
  await connectMarketplaceOneTap(marketplace, shopDomain);
}

export function oneTapHelpText(): string {
  if (Platform.OS === 'ios') {
    return 'Uses Sign in with Safari — if you’re already logged into Etsy/eBay/Shopify in Safari or saved in iCloud Keychain, one tap connects you. Otherwise you’ll sign in once in the browser (we never store your password).';
  }
  if (Platform.OS === 'android') {
    return 'Opens Chrome — if you’re already logged in or your password is saved, one tap connects you. Otherwise you’ll sign in once in the browser (we never store your password).';
  }
  return 'Opens your system browser for OAuth. Tokens stay on this device only.';
}
