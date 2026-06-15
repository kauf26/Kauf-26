/**
 * Device-side OAuth code exchange. PKCE flows hit the marketplace directly.
 * Secret-required flows use a stateless server proxy (no token persistence on server).
 */
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import { API_BASE_URL } from './config';
import type { ConnectContext, StoredPlatformTokens } from './secureTokenStore';

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

function usesPkceExchange(config: MarketplaceOAuthProviderConfig): boolean {
  return (
    config.usePkce === true ||
    config.tokenExchange === 'json_pkce' ||
    config.oauthFlow === 'authorization_code_pkce'
  );
}

function needsStatelessServerProxy(config: MarketplaceOAuthProviderConfig): boolean {
  return !usesPkceExchange(config);
}

export async function exchangeAuthorizationCodeOnDevice(
  config: MarketplaceOAuthProviderConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string | undefined,
  ctx: ConnectContext,
  tokenUrl: string
): Promise<StoredPlatformTokens> {
  if (needsStatelessServerProxy(config)) {
    const res = await fetch(`${API_BASE_URL}/api/auth/${config.id}/token-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code,
        redirectUri,
        codeVerifier,
        shopDomain: ctx.shopDomain,
        siteUrl: ctx.siteUrl,
        baseUrl: ctx.baseUrl,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: string;
      details?: string;
    };
    if (!res.ok) {
      throw new Error(String(json.details ?? json.error ?? 'Token exchange failed'));
    }
    return parseTokenResponse(json, config, ctx);
  }

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

  throw new Error(`${config.name} requires PKCE or server token proxy — check OAuth configuration`);
}
