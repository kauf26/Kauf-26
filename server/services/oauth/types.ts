export type OAuthProviderId = "etsy" | "ebay" | "shopify" | "amazon";

export const UNIVERSAL_OAUTH_PROVIDERS: OAuthProviderId[] = [
  "etsy",
  "ebay",
  "shopify",
  "amazon",
];

export type TokenResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  shopDomain?: string;
  marketplaceShopId?: string;
  accountLabel?: string;
  metadata?: Record<string, unknown>;
};

export type OAuthConnectOptions = {
  shopDomain?: string;
  returnTo?: "web" | "mobile";
};

export type OAuthPendingSession = {
  provider: OAuthProviderId;
  state: string;
  nonce: string;
  codeVerifier?: string;
  shopDomain?: string;
  userId: number | null;
  returnTo: "web" | "mobile";
};

export type EncodedOAuthState = {
  p: OAuthProviderId;
  n: string;
  u: number | null;
};

export function isUniversalOAuthProvider(id: string): id is OAuthProviderId {
  return UNIVERSAL_OAUTH_PROVIDERS.includes(id as OAuthProviderId);
}

/** Reserved /api/auth paths — never treat as marketplace providers. */
export const RESERVED_AUTH_PATHS = new Set([
  "google",
  "apple",
  "user",
  "status",
  "login",
  "setup",
  "callback",
  "connections",
  "exchange",
]);
