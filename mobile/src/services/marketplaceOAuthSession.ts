/**
 * Shared OAuth session preparation for system-browser and in-app WebView flows.
 */
import * as AuthSession from 'expo-auth-session';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import { assertRedirectUriMatches } from '../../../shared/oauthRedirect';
import { getConnectBlockedReason } from './auth';
import { getOAuthProvider } from './oauthConfig';
import { saveConnectContext, type ConnectContext } from './secureTokenStore';

export type OAuthSessionPrep = {
  config: MarketplaceOAuthProviderConfig;
  ctx: ConnectContext;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  request: AuthSession.AuthRequest;
};

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

function extraAuthParams(marketplaceId: string): Record<string, string> {
  if (marketplaceId === 'ebay') {
    return { prompt: 'login' };
  }
  if (marketplaceId === 'amazon') {
    return { version: 'beta' };
  }
  return {};
}

export async function prepareMarketplaceOAuthSession(
  marketplaceId: string,
  options: ConnectContext = {}
): Promise<OAuthSessionPrep> {
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

  const ctx = await validateConnectContext(config, options);
  const redirectUri = assertRedirectUriMatches(marketplaceId, config.redirectUri);
  const urls = resolveUrls(config, ctx);

  const usePkce = config.usePkce ?? config.tokenExchange === 'json_pkce';
  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: usePkce,
    extraParams: extraAuthParams(marketplaceId),
  });

  return {
    config,
    ctx,
    redirectUri,
    authUrl: urls.authUrl,
    tokenUrl: urls.tokenUrl,
    request,
  };
}

export async function buildAuthorizationUrl(prep: OAuthSessionPrep): Promise<string> {
  return prep.request.makeAuthUrlAsync({
    authorizationEndpoint: prep.authUrl,
  });
}
