/**
 * Unified one-tap OAuth for all Kauf26 marketplaces.
 * Tokens are stored only on-device (expo-secure-store).
 * PKCE exchanges run on the device; secret-required flows use a stateless server proxy.
 */
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import { assertRedirectUriMatches } from '../../../shared/oauthRedirect';
import { getOAuthManifestEntry } from '../../../shared/marketplaceOAuthManifest';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import { getConnectBlockedReason } from './auth';
import { getOAuthProvider } from './oauthConfig';
import { exchangeAuthorizationCodeOnDevice } from './oauthTokenExchange';
import { openSystemBrowserOAuth } from './systemBrowserOAuth';
import {
  loadConnectContext,
  saveConnectContext,
  savePlatformTokens,
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
      throw new Error(
        getConnectBlockedReason(marketplaceId, false) ??
          `${config?.name ?? marketplaceId} OAuth is not configured on the server`
      );
    }

    const blocked = getConnectBlockedReason(marketplaceId, true);
    if (blocked) {
      throw new Error(blocked);
    }

    const savedCtx = (await loadConnectContext(marketplaceId)) ?? {};
    const ctx = await validateConnectContext(config, { ...savedCtx, ...options });
    const redirectUri = assertRedirectUriMatches(marketplaceId, config.redirectUri);
    const urls = resolveUrls(config, ctx);

    const usePkce = config.usePkce ?? config.tokenExchange === 'json_pkce';
    const request = new AuthSession.AuthRequest({
      clientId: config.clientId,
      scopes: config.scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: usePkce,
    });

    const { code, elapsedMs } = await openSystemBrowserOAuth(request, {
      authorizationEndpoint: urls.authUrl,
      tokenEndpoint: urls.tokenUrl,
    });

    let tokens = await exchangeAuthorizationCodeOnDevice(
      config,
      redirectUri,
      code,
      request.codeVerifier ?? undefined,
      ctx,
      urls.tokenUrl
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
  return 'Opens your system browser for OAuth. Marketplace tokens stay on this device only.';
}

export { getOAuthRedirectUri, OAUTH_REDIRECT_URIS } from './oauthRedirect';
