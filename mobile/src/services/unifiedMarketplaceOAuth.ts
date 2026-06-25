/**
 * Unified one-tap OAuth for all Kauf26 marketplaces.
 * Tokens are stored only on-device (expo-secure-store).
 * PKCE exchanges run on the device; secret-required flows use a stateless server proxy.
 */
import { Platform } from 'react-native';
import { getOAuthManifestEntry } from '../../../shared/marketplaceOAuthManifest';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import { getConnectBlockedReason } from './auth';
import { exchangeAuthorizationCodeOnDevice } from './oauthTokenExchange';
import { openSystemBrowserOAuth } from './systemBrowserOAuth';
import { prepareMarketplaceOAuthSession } from './marketplaceOAuthSession';
import {
  savePlatformTokens,
  type ConnectContext,
  type StoredPlatformTokens,
} from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile } from '../types/marketplaceConnect';
import { normalizeOAuthError } from './oauthErrors';

export type ConnectOptions = ConnectContext;

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

    const session = await prepareMarketplaceOAuthSession(marketplaceId, options);
    const { config, ctx, redirectUri, tokenUrl, request } = session;

    const { code, elapsedMs } = await openSystemBrowserOAuth(request, {
      authorizationEndpoint: session.authUrl,
      tokenEndpoint: tokenUrl,
    });

    let tokens = await exchangeAuthorizationCodeOnDevice(
      config,
      redirectUri,
      code,
      request.codeVerifier ?? undefined,
      ctx,
      tokenUrl
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
