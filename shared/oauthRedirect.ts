/**
 * Canonical OAuth redirect URIs for mobile one-tap connect.
 * Must match exactly in server .env, marketplace developer consoles, and OAuth requests.
 */
export const OAUTH_APP_SCHEME = 'kauf26';

export const OAUTH_REDIRECT_URIS = {
  etsy: 'kauf26://oauth/etsy',
  shopify: 'kauf26://oauth/shopify',
  ebay: 'kauf26://oauth/ebay',
} as const;

export type OAuthRedirectMarketplace = keyof typeof OAUTH_REDIRECT_URIS;

export function getOAuthRedirectUri(marketplace: OAuthRedirectMarketplace): string {
  return OAUTH_REDIRECT_URIS[marketplace];
}

/** Deep-link prefix for all marketplace OAuth callbacks. */
export const OAUTH_CALLBACK_PREFIX = `${OAUTH_APP_SCHEME}://oauth/`;

export function isOAuthCallbackUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith(OAUTH_CALLBACK_PREFIX));
}

/** Warn if server config drifts from canonical URIs (token exchange requires an exact match). */
export function assertRedirectUriMatches(
  marketplace: OAuthRedirectMarketplace,
  configuredUri: string | undefined
): string {
  const canonical = getOAuthRedirectUri(marketplace);
  if (configuredUri && configuredUri !== canonical) {
    throw new Error(
      `${marketplace} redirect URI mismatch: server has "${configuredUri}" but OAuth requires "${canonical}". Update .env and the developer console.`
    );
  }
  return configuredUri ?? canonical;
}
