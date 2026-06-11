/**
 * Marketplace OAuth credential helpers for the mobile app.
 *
 * Authorize/token URLs live in shared/marketplaceOAuthManifest.ts (real marketplace
 * endpoints — not placeholders). The server exposes resolved metadata at
 * GET /api/marketplaces/oauth-config.
 *
 * Server .env: client IDs (ETSY_CLIENT_ID, EBAY_CLIENT_ID, AMAZON_CLIENT_ID, …)
 * mobile/.env: on-device token-exchange secrets (EXPO_PUBLIC_EBAY_CLIENT_SECRET, …)
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
import { usesServerOAuth } from './serverMarketplaceOAuth';

export const CREDENTIALS_NOT_CONFIGURED = 'Credentials not configured';

/** Primary OAuth marketplaces — register redirect URIs in each developer portal. */
export const PRIMARY_OAUTH_ENDPOINTS = {
  ebay: {
    authUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    // TODO: Set EBAY_CLIENT_ID + EBAY_CLIENT_SECRET in server .env
    // TODO: Set EXPO_PUBLIC_EBAY_CLIENT_SECRET in mobile/.env for on-device exchange
    clientIdEnv: 'EBAY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('ebay'),
  },
  amazon: {
    authUrl: 'https://sellercentral.amazon.com/apps/authorize/consent',
    tokenUrl: 'https://api.amazon.com/auth/o2/token',
    // TODO: Set AMAZON_CLIENT_ID + AMAZON_CLIENT_SECRET in server .env
    clientIdEnv: 'AMAZON_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('amazon'),
  },
  etsy: {
    authUrl: 'https://www.etsy.com/oauth/connect',
    tokenUrl: 'https://api.etsy.com/v3/public/oauth/token',
    // TODO: Set ETSY_CLIENT_ID in server .env (PKCE — no mobile client secret)
    clientIdEnv: 'ETSY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('etsy'),
  },
  shopify: {
    authUrl: 'https://{shop}/admin/oauth/authorize',
    tokenUrl: 'https://{shop}/admin/oauth/access_token',
    // TODO: Set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET in server .env
    // TODO: Set EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET in mobile/.env for on-device exchange
    clientIdEnv: 'SHOPIFY_CLIENT_ID',
    redirectUri: getOAuthRedirectUri('shopify'),
  },
} as const;

export function requiresMobileClientSecret(entry: MarketplaceOAuthManifestEntry): boolean {
  if (!entry.oauthSupported) return false;
  if (entry.oauthFlow === 'authorization_code_pkce' || entry.tokenExchange === 'json_pkce') {
    return false;
  }
  return Boolean(entry.mobileClientSecretEnv);
}

export function isMobileClientSecretConfigured(marketplaceId: string): boolean {
  const entry = getOAuthManifestEntry(marketplaceId);
  if (!entry || !requiresMobileClientSecret(entry)) return true;
  const envKey = entry.mobileClientSecretEnv!;
  return Boolean(process.env[envKey]?.trim());
}

export function isFullyConfiguredForConnect(
  marketplaceId: string,
  serverConfigured: boolean
): boolean {
  if (!serverConfigured) return false;
  if (usesServerOAuth(marketplaceId)) return true;
  return isMobileClientSecretConfigured(marketplaceId);
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
  if (!isMobileClientSecretConfigured(marketplaceId)) {
    const entry = getOAuthManifestEntry(marketplaceId);
    const envKey = entry?.mobileClientSecretEnv ?? 'EXPO_PUBLIC_*_CLIENT_SECRET';
    return `${CREDENTIALS_NOT_CONFIGURED} — set ${envKey} in mobile/.env`;
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
