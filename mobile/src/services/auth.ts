/**
 * Marketplace OAuth credential helpers for the mobile app.
 *
 * Authorize/token URLs live in shared/marketplaceOAuthManifest.ts.
 * The server exposes public metadata at GET /api/marketplaces/oauth-config.
 * Token exchange: PKCE on-device, or POST /api/auth/:marketplace/token-proxy (stateless).
 */
import {
  getOAuthManifestEntry,
  MARKETPLACE_OAUTH_MANIFEST,
} from '../../../shared/marketplaceOAuthManifest';
import type {
  MarketplaceOAuthManifestEntry,
  MarketplaceOAuthProviderConfig,
} from '../../../shared/marketplaceOAuthTypes';
import { getOAuthRedirectUri } from '../../../shared/oauthRedirect';

export const CREDENTIALS_NOT_CONFIGURED = 'Credentials not configured';

/** Primary OAuth marketplaces — register redirect URIs in each developer portal. */
export const PRIMARY_OAUTH_ENDPOINTS = {
  ebay: {
    authUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    clientIdEnv: 'EBAY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('ebay'),
  },
  amazon: {
    authUrl: 'https://sellercentral.amazon.com/apps/authorize/consent',
    tokenUrl: 'https://api.amazon.com/auth/o2/token',
    clientIdEnv: 'AMAZON_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('amazon'),
  },
  etsy: {
    authUrl: 'https://www.etsy.com/oauth/connect',
    tokenUrl: 'https://api.etsy.com/v3/public/oauth/token',
    clientIdEnv: 'ETSY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('etsy'),
  },
  shopify: {
    authUrl: 'https://{shop}/admin/oauth/authorize',
    tokenUrl: 'https://{shop}/admin/oauth/access_token',
    clientIdEnv: 'SHOPIFY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('shopify'),
  },
} as const;

export function isFullyConfiguredForConnect(
  _marketplaceId: string,
  serverConfigured: boolean
): boolean {
  return serverConfigured;
}

export function getConnectBlockedReason(
  marketplaceId: string,
  serverConfigured: boolean
): string | null {
  if (!serverConfigured) {
    const entry = getOAuthManifestEntry(marketplaceId);
    const envHint = entry?.clientIdEnv ? ` (set ${entry.clientIdEnv} in server .env)` : '';
    return `${CREDENTIALS_NOT_CONFIGURED}${envHint}`;
  }
  return null;
}

/** Offline fallback when GET /api/marketplaces/oauth-config is unreachable. */
export function manifestFallbackProviders(): MarketplaceOAuthProviderConfig[] {
  return MARKETPLACE_OAUTH_MANIFEST.map((entry) => ({
    id: entry.id,
    name: entry.name,
    authUrl: entry.authUrl,
    tokenUrl: entry.tokenUrl,
    userInfoUrl: entry.userInfoUrl,
    clientId: '',
    scopes: entry.scopes,
    redirectUri: getOAuthRedirectUri(entry.id),
    oauthFlow: entry.oauthFlow,
    oauthSupported: entry.oauthSupported,
    tokenExchange: entry.tokenExchange,
    userInfoAuth: entry.userInfoAuth,
    userInfoMapping: entry.userInfoMapping,
    requiresShopDomain: entry.requiresShopDomain,
    requiresSiteUrl: entry.requiresSiteUrl,
    requiresBaseUrl: entry.requiresBaseUrl,
    urlPlaceholders: entry.urlPlaceholders,
    usePkce: entry.usePkce,
    notes: entry.notes,
    developerPortalUrl: entry.developerPortalUrl,
    redirectUriRegistrationHint: entry.redirectUriRegistrationHint,
    configured: false,
  }));
}

/** @deprecated Mobile no longer reads client secrets from the bundle. */
export function requiresMobileClientSecret(_entry: MarketplaceOAuthManifestEntry): boolean {
  return false;
}

/** @deprecated Mobile no longer reads client secrets from the bundle. */
export function isMobileClientSecretConfigured(_marketplaceId: string): boolean {
  return true;
}
