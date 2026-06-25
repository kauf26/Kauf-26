/**
 * In-app WebView OAuth for marketplace connect (eBay, Amazon, etc.).
 * Tokens are stored on-device via expo-secure-store after code exchange.
 */
import { isOAuthCallbackUrl } from '../../../shared/oauthRedirect';
import { fetchMarketplaceUserProfile } from './marketplaceUserInfo';
import {
  buildAuthorizationUrl,
  prepareMarketplaceOAuthSession,
  type OAuthSessionPrep,
} from './marketplaceOAuthSession';
import { exchangeAuthorizationCodeOnDevice } from './oauthTokenExchange';
import { OAuthCancelledError, OAuthSessionError, normalizeOAuthError } from './oauthErrors';
import {
  savePlatformTokens,
  type ConnectContext,
  type StoredPlatformTokens,
} from './secureTokenStore';
import type { ConnectResult, MarketplaceUserProfile } from '../types/marketplaceConnect';

export type OAuthWebViewSession = OAuthSessionPrep & {
  authorizationUrl: string;
};

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

export async function startMarketplaceOAuthWebView(
  marketplaceId: string,
  options: ConnectContext = {}
): Promise<OAuthWebViewSession> {
  const prep = await prepareMarketplaceOAuthSession(marketplaceId, options);
  const authorizationUrl = await buildAuthorizationUrl(prep);
  return { ...prep, authorizationUrl };
}

export function parseOAuthWebViewCallback(
  url: string,
  redirectUri: string
): { code?: string; error?: string; cancelled?: boolean } {
  if (!isOAuthCallbackUrl(url)) {
    return {};
  }

  const parsed = new URL(url);
  const connected = parsed.searchParams.get('connected');
  if (connected === '0') {
    const reason = parsed.searchParams.get('reason') ?? 'Authorization failed';
    throw new OAuthSessionError(decodeURIComponent(reason));
  }

  const error =
    parsed.searchParams.get('error_description') ??
    parsed.searchParams.get('error') ??
    undefined;
  if (error) {
    throw new OAuthSessionError(decodeURIComponent(error));
  }

  const code = parsed.searchParams.get('code') ?? undefined;
  if (!code) {
    return { cancelled: true };
  }

  if (!url.startsWith(redirectUri.split('?')[0])) {
    // Allow query params on redirect URI match
    const baseRedirect = redirectUri.replace(/\?.*$/, '');
    if (!url.startsWith(baseRedirect)) {
      throw new OAuthSessionError('Unexpected OAuth callback URL');
    }
  }

  return { code };
}

export async function completeMarketplaceOAuthWebView(
  session: OAuthWebViewSession,
  code: string
): Promise<ConnectResult> {
  try {
    let tokens = await exchangeAuthorizationCodeOnDevice(
      session.config,
      session.redirectUri,
      code,
      session.request.codeVerifier ?? undefined,
      session.ctx,
      session.tokenUrl
    );

    const profile = await fetchMarketplaceUserProfile(
      session.config.id,
      session.config,
      tokens,
      session.ctx
    );
    tokens = mergeProfileIntoTokens(tokens, profile);
    await savePlatformTokens(session.config.id, tokens);

    return {
      marketplace: session.config.id,
      oneTapLikely: false,
      profile,
    };
  } catch (err) {
    throw normalizeOAuthError(err);
  }
}

export function isOAuthWebViewCallbackUrl(url: string): boolean {
  return isOAuthCallbackUrl(url);
}

export { OAuthCancelledError, OAuthSessionError };
