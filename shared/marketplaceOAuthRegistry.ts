/**
 * Resolves OAuth provider configs from manifest + environment variables.
 * Server uses this for GET /api/marketplaces/oauth-config (public metadata only).
 */
import {
  MARKETPLACE_OAUTH_MANIFEST,
  getOAuthManifestEntry,
} from "./marketplaceOAuthManifest";
import { assertRedirectUriMatches, getOAuthRedirectUri } from "./oauthRedirect";
import type {
  MarketplaceOAuthManifestEntry,
  MarketplaceOAuthProviderConfig,
} from "./marketplaceOAuthTypes";

export type EnvReader = (key: string) => string | undefined;

const defaultEnv: EnvReader = (key) =>
  typeof process !== "undefined" ? process.env[key] : undefined;

function resolveAuthUrl(entry: MarketplaceOAuthManifestEntry, env: EnvReader): string {
  if (entry.id === "ebay" && env("EBAY_SANDBOX") === "true") {
    return "https://auth.sandbox.ebay.com/oauth2/authorize";
  }
  if (entry.id === "ebay") {
    return entry.authUrl;
  }
  return entry.authUrl;
}

function resolveTokenUrl(entry: MarketplaceOAuthManifestEntry, env: EnvReader): string {
  if (entry.id === "ebay" && env("EBAY_SANDBOX") === "true") {
    return "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
  }
  return entry.tokenUrl;
}

function resolveScopes(entry: MarketplaceOAuthManifestEntry, env: EnvReader): string[] {
  const envKey = `${entry.id.toUpperCase()}_OAUTH_SCOPES`;
  const override = env(envKey) ?? env(`${entry.id.toUpperCase().replace(/-/g, "_")}_OAUTH_SCOPES`);
  if (override?.trim()) {
    return override.split(/[\s,]+/).filter(Boolean);
  }
  if (entry.id === "etsy" && env("ETSY_OAUTH_SCOPES")) {
    return env("ETSY_OAUTH_SCOPES")!.split(/[\s,]+/).filter(Boolean);
  }
  if (entry.id === "ebay" && env("EBAY_OAUTH_SCOPES")) {
    return env("EBAY_OAUTH_SCOPES")!.split(/[\s,]+/).filter(Boolean);
  }
  if (entry.id === "shopify" && env("SHOPIFY_OAUTH_SCOPES")) {
    return env("SHOPIFY_OAUTH_SCOPES")!.split(/[\s,]+/).filter(Boolean);
  }
  return entry.scopes;
}

function resolveClientId(entry: MarketplaceOAuthManifestEntry, env: EnvReader): string | undefined {
  let id = env(entry.clientIdEnv);
  if (entry.id === "ebay" && !id) {
    id = env("EBAY_APP_ID");
  }
  return id?.trim() || undefined;
}

function resolveRedirectOverride(entry: MarketplaceOAuthManifestEntry, env: EnvReader): string | undefined {
  const keys = [
    `${entry.id.toUpperCase()}_REDIRECT_URI`,
    `${entry.id.toUpperCase()}_OAUTH_REDIRECT_URI`,
  ];
  if (entry.id === "shopify") keys.unshift("SHOPIFY_OAUTH_REDIRECT_URI");
  if (entry.id === "etsy") keys.unshift("ETSY_REDIRECT_URI");
  for (const key of keys) {
    const val = env(key);
    if (val?.trim()) return val.trim();
  }
  return undefined;
}

export function manifestEntryToProviderConfig(
  entry: MarketplaceOAuthManifestEntry,
  env: EnvReader = defaultEnv
): MarketplaceOAuthProviderConfig {
  const clientId = resolveClientId(entry, env) ?? "";
  const redirectOverride = resolveRedirectOverride(entry, env);
  const redirectUri = assertRedirectUriMatches(entry.id, redirectOverride);

  return {
    id: entry.id,
    name: entry.name,
    authUrl: resolveAuthUrl(entry, env),
    tokenUrl: resolveTokenUrl(entry, env),
    userInfoUrl: entry.userInfoUrl,
    clientId,
    scopes: resolveScopes(entry, env),
    redirectUri,
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
    configured: Boolean(clientId) && entry.oauthSupported,
  };
}

/** All 26 manifest entries with env resolution (includes unconfigured / non-OAuth). */
export function getAllMarketplaceOAuthProviders(
  env: EnvReader = defaultEnv
): MarketplaceOAuthProviderConfig[] {
  return MARKETPLACE_OAUTH_MANIFEST.map((entry) => manifestEntryToProviderConfig(entry, env));
}

/** OAuth-capable providers with client id set — ready for mobile one-tap connect. */
export function getConfiguredOAuthProviders(
  env: EnvReader = defaultEnv
): MarketplaceOAuthProviderConfig[] {
  return getAllMarketplaceOAuthProviders(env).filter((p) => p.configured);
}

export function getOAuthProviderById(
  id: string,
  env: EnvReader = defaultEnv
): MarketplaceOAuthProviderConfig | undefined {
  const entry = getOAuthManifestEntry(id);
  if (!entry) return undefined;
  return manifestEntryToProviderConfig(entry, env);
}

export function getRedirectUriForMarketplace(id: string): string {
  return getOAuthRedirectUri(id);
}
