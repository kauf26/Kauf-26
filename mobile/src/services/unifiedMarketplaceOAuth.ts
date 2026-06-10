/**
 * Unified one-tap OAuth for all Kauf26 marketplaces.
 * iOS: ASWebAuthenticationSession | Android: Chrome Custom Tabs
 * Tokens + profile stay on device only (SecureStore).
 */
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import { assertRedirectUriMatches } from '../../../shared/oauthRedirect';
import { getOAuthManifestEntry } from '../../../shared/marketplaceOAuthManifest';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import {
  getOAuthProvider,
  getMobileClientSecret,
} from './oauthConfig';
import { openSystemBrowserOAuth } from './systemBrowserOAuth';
import {
  loadConnectContext,
  saveConnectContext,
  savePlatformTokens,
  saveShopDomain,
  type ConnectContext,
  type StoredPlatformTokens,
} from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile } from '../types/marketplaceConnect';
import { normalizeOAuthError } from './oauthErrors';

export type ConnectOptions = ConnectContext;

function normalizeShop(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (!cleaned) throw new Error('Shop domain required');
  return cleaned.includes('.') ? cleaned : `${cleaned}.myshopify.com`;
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
}

function resolveUrls(
  config: MarketplaceOAuthProviderConfig,
  ctx: ConnectContext
): { authUrl: string; tokenUrl: string; userInfoUrl: string } {
  const shop = ctx.shopDomain ? normalizeShop(ctx.shopDomain) : '';
  const site = ctx.siteUrl ? normalizeSiteUrl(ctx.siteUrl) : '';
  const base = ctx.baseUrl ? normalizeSiteUrl(ctx.baseUrl) : '';
  const sub = (url: string) =>
    url.replace('{shop}', shop).replace('{site}', site).replace('{base}', base);
  return {
    authUrl: sub(config.authUrl),
    tokenUrl: sub(config.tokenUrl),
    userInfoUrl: sub(config.userInfoUrl),
  };
}

async function validateConnectContext(
  config: MarketplaceOAuthProviderConfig,
  ctx: ConnectContext
): Promise<ConnectContext> {
  const next = { ...ctx };
  if (config.requiresShopDomain) {
    if (!ctx.shopDomain?.trim()) throw new Error('Enter your store domain first');
    next.shopDomain = normalizeShop(ctx.shopDomain);
    if (config.id === 'shopify') await saveShopDomain(next.shopDomain);
  }
  if (config.requiresSiteUrl && !ctx.siteUrl?.trim()) {
    throw new Error('Enter your site URL first');
  }
  if (config.requiresBaseUrl && !ctx.baseUrl?.trim()) {
    throw new Error('Enter your store base URL first');
  }
  await saveConnectContext(config.id, next);
  return next;
}

function parseTokenResponse(
  json: Record<string, unknown>,
  config: MarketplaceOAuthProviderConfig,
  ctx: ConnectContext
): StoredPlatformTokens {
  const accessToken = String(json.access_token ?? '');
  if (!accessToken) throw new Error('Token response missing access_token');

  let userId: string | undefined;
  if (config.id === 'etsy') {
    userId = accessToken.split('.')[0];
  } else if (json.user_id != null) {
    userId = String(json.user_id);
  }

  return {
    accessToken,
    refreshToken: String(json.refresh_token ?? ''),
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    userId,
    shopDomain: ctx.shopDomain,
    accountName: ctx.shopDomain ?? config.name,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
  };
}

async function exchangeAuthorizationCode(
  config: MarketplaceOAuthProviderConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string | undefined,
  ctx: ConnectContext
): Promise<StoredPlatformTokens> {
  const { tokenUrl } = resolveUrls(config, ctx);
  const secret = getMobileClientSecret(config.id);

  if (config.tokenExchange === 'json_pkce') {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier ?? '',
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? 'Token exchange failed'));
    }
    return parseTokenResponse(json, config, ctx);
  }

  if (config.tokenExchange === 'json_secret') {
    if (!secret) {
      throw new Error(`Set mobile client secret for ${config.name} in build config`);
    }
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: secret,
        code,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? 'Token exchange failed'));
    }
    return parseTokenResponse(json, config, ctx);
  }

  if (config.tokenExchange === 'form_basic') {
    if (!secret) {
      throw new Error(`Set mobile client secret for ${config.name} in build config`);
    }
    const basic = btoa(`${config.clientId}:${secret}`);
    const res = await fetch(tokenUrl, {
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
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.error_description ?? json.error ?? 'Token exchange failed'));
    }
    return parseTokenResponse(json, config, ctx);
  }

  // form_secret (default for most OAuth2 providers)
  if (!secret && config.oauthFlow !== 'authorization_code_pkce') {
    throw new Error(`Set mobile client secret for ${config.name} in build config`);
  }
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
  };
  if (secret) params.client_secret = secret;
  if (codeVerifier) params.code_verifier = codeVerifier;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.error_description ?? json.error ?? 'Token exchange failed'));
  }
  return parseTokenResponse(json, config, ctx);
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
 * One-tap connect for any OAuth-capable marketplace in the registry.
 */
export async function connectMarketplaceOneTap(
  marketplaceId: string,
  options: ConnectOptions = {}
): Promise<ConnectResult> {
  try {
    const manifest = getOAuthManifestEntry(marketplaceId);
    if (!manifest?.oauthSupported) {
      throw new Error(
        `${manifest?.name ?? marketplaceId} does not support mobile OAuth — partnership or API key required.`
      );
    }

    const config = await getOAuthProvider(marketplaceId);
    if (!config?.configured) {
      throw new Error(`${config?.name ?? marketplaceId} OAuth is not configured on the server`);
    }

    const savedCtx = (await loadConnectContext(marketplaceId)) ?? {};
    const ctx = await validateConnectContext(config, { ...savedCtx, ...options });
    const redirectUri = assertRedirectUriMatches(marketplaceId, config.redirectUri);
    const { authUrl } = resolveUrls(config, ctx);

    const usePkce = config.usePkce ?? config.tokenExchange === 'json_pkce';
    const request = new AuthSession.AuthRequest({
      clientId: config.clientId,
      scopes: config.scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: usePkce,
    });

    const { code, elapsedMs } = await openSystemBrowserOAuth(request, {
      authorizationEndpoint: authUrl,
      tokenEndpoint: resolveUrls(config, ctx).tokenUrl,
    });

    let tokens = await exchangeAuthorizationCode(
      config,
      redirectUri,
      code,
      request.codeVerifier ?? undefined,
      ctx
    );

    const profile = await fetchMarketplaceUserProfile(marketplaceId, config, tokens, ctx);
    tokens = mergeProfileIntoTokens(tokens, profile);
    await savePlatformTokens(marketplaceId, tokens);

    return {
      marketplace: marketplaceId,
      oneTapLikely: elapsedMs < 8000,
      profile,
    };
  } catch (err) {
    throw normalizeOAuthError(err);
  }
}

/** @deprecated Use connectMarketplaceOneTap */
export async function connectMarketplace(
  marketplace: string,
  shopDomain?: string
): Promise<void> {
  await connectMarketplaceOneTap(marketplace, { shopDomain });
}

export function oneTapHelpText(): string {
  if (Platform.OS === 'ios') {
    return 'Uses Sign in with Safari — if you’re already logged into a marketplace in Safari or saved in iCloud Keychain, one tap connects you. Otherwise you’ll sign in once in the browser (we never store your password).';
  }
  if (Platform.OS === 'android') {
    return 'Opens Chrome Custom Tabs — saved passwords and active sessions enable one-tap connect. Otherwise you’ll sign in once in the system browser (we never store your password).';
  }
  return 'Opens your system browser for OAuth. Tokens stay on this device only.';
}

export { getOAuthRedirectUri, OAUTH_REDIRECT_URIS } from './oauthRedirect';
