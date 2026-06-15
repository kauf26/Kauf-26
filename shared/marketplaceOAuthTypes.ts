/**
 * Unified marketplace OAuth provider configuration (mobile one-tap connect).
 * Tokens stay on device only — server exposes public metadata via /api/marketplaces/oauth-config.
 */

export type MarketplaceOAuthFlow =
  | "authorization_code_pkce"
  | "authorization_code_secret"
  | "authorization_code_basic"
  | "partnership"
  | "api_key";

export type TokenExchangeStyle =
  | "json_pkce"
  | "json_secret"
  | "form_basic"
  | "form_secret";

export type UserInfoAuthStyle = "bearer" | "etsy" | "shopify" | "ebay" | "none";

export type UserInfoFieldMapping = {
  name?: string[];
  email?: string[];
  userId?: string[];
  accountLabel?: string[];
};

/** Static manifest entry for a marketplace OAuth provider. */
export type MarketplaceOAuthManifestEntry = {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  /** Server env var for OAuth client id (public in mobile config response). */
  clientIdEnv: string;
  /** Mobile build env for on-device token exchange (EXPO_PUBLIC_*). */
  /** Server-side secret env key (never EXPO_PUBLIC_* in mobile builds). */
  mobileClientSecretEnv?: string;
  scopes: string[];
  oauthFlow: MarketplaceOAuthFlow;
  oauthSupported: boolean;
  tokenExchange: TokenExchangeStyle;
  userInfoAuth: UserInfoAuthStyle;
  userInfoMapping?: UserInfoFieldMapping;
  requiresShopDomain?: boolean;
  requiresSiteUrl?: boolean;
  requiresBaseUrl?: boolean;
  /** Substitute {shop}, {site}, {base} in auth/token URLs. */
  urlPlaceholders?: ("shop" | "site" | "base")[];
  usePkce?: boolean;
  notes?: string;
  developerPortalUrl?: string;
  redirectUriRegistrationHint?: string;
};

/** Resolved provider sent to mobile clients (no secrets). */
export type MarketplaceOAuthProviderConfig = {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  scopes: string[];
  redirectUri: string;
  oauthFlow: MarketplaceOAuthFlow;
  oauthSupported: boolean;
  tokenExchange: TokenExchangeStyle;
  userInfoAuth: UserInfoAuthStyle;
  userInfoMapping?: UserInfoFieldMapping;
  requiresShopDomain?: boolean;
  requiresSiteUrl?: boolean;
  requiresBaseUrl?: boolean;
  urlPlaceholders?: ("shop" | "site" | "base")[];
  usePkce?: boolean;
  notes?: string;
  developerPortalUrl?: string;
  redirectUriRegistrationHint?: string;
  configured: boolean;
};

export type MarketplaceConnectResult = {
  marketplace: string;
  oneTapLikely: boolean;
  profile: {
    marketplace: string;
    name?: string;
    email?: string;
    accountLabel?: string;
    userId?: string;
    shopId?: string;
  };
};
