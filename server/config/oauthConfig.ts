/**
 * Public OAuth metadata for mobile clients — all 26 marketplaces.
 * No secrets, no tokens — mobile performs OAuth and stores tokens in SecureStore.
 */
import {
  getAllMarketplaceOAuthProviders,
  getConfiguredOAuthProviders,
  getOAuthProviderById,
} from "../../shared/marketplaceOAuthRegistry";
import { env } from "../services/adapters/adapterUtils";

function readEnv(key: string): string | undefined {
  return env(key);
}

/** @deprecated Legacy shape — use MarketplaceOAuthProviderConfig from shared types. */
export type MarketplaceOAuthConfig = {
  marketplace: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  requiresShopDomain?: boolean;
  requiresSiteUrl?: boolean;
  requiresBaseUrl?: boolean;
};

export function getMarketplaceOAuthConfigs() {
  return getConfiguredOAuthProviders(readEnv);
}

export function getAllMarketplaceOAuthConfigs() {
  return getAllMarketplaceOAuthProviders(readEnv);
}

export function getOAuthConfigFor(marketplace: string) {
  return getOAuthProviderById(marketplace, readEnv);
}

/** Legacy adapter for code expecting MarketplaceOAuthConfig[]. */
export function getLegacyMarketplaceOAuthConfigs(): MarketplaceOAuthConfig[] {
  return getConfiguredOAuthProviders(readEnv).map((p) => ({
    marketplace: p.id,
    clientId: p.clientId,
    scopes: p.scopes.join(" "),
    redirectUri: p.redirectUri,
    authorizeUrl: p.authUrl,
    tokenUrl: p.tokenUrl,
    requiresShopDomain: p.requiresShopDomain,
    requiresSiteUrl: p.requiresSiteUrl,
    requiresBaseUrl: p.requiresBaseUrl,
  }));
}

/** Safe payload for GET /api/marketplaces/oauth-config (never throws). */
export function buildMarketplaceOAuthConfigResponse() {
  const providers = getAllMarketplaceOAuthConfigs();
  const configured = getMarketplaceOAuthConfigs();
  return {
    providers,
    configured,
    /** @deprecated use `providers` */
    marketplaces: configured.map((p) => ({
      marketplace: p.id,
      clientId: p.clientId,
      scopes: p.scopes.join(" "),
      redirectUri: p.redirectUri,
      authorizeUrl: p.authUrl,
      tokenUrl: p.tokenUrl,
      requiresShopDomain: p.requiresShopDomain,
    })),
  };
}
