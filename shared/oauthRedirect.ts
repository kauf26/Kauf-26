/**
 * Canonical OAuth redirect URIs for mobile one-tap connect.
 * Pattern: kauf26://oauth/{marketplace_id}
 */

export const OAUTH_APP_SCHEME = "kauf26";

/** Deep-link prefix for all marketplace OAuth callbacks. */
export const OAUTH_CALLBACK_PREFIX = `${OAUTH_APP_SCHEME}://oauth/`;

export function getOAuthRedirectUri(marketplaceId: string): string {
  return `${OAUTH_APP_SCHEME}://oauth/${marketplaceId.toLowerCase()}`;
}

/** @deprecated Use getOAuthRedirectUri(id) — kept for legacy imports. */
export const OAUTH_REDIRECT_URIS = {
  etsy: getOAuthRedirectUri("etsy"),
  shopify: getOAuthRedirectUri("shopify"),
  ebay: getOAuthRedirectUri("ebay"),
} as const;

export type OAuthRedirectMarketplace = keyof typeof OAUTH_REDIRECT_URIS;

export function isOAuthCallbackUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith(OAUTH_CALLBACK_PREFIX));
}

export function assertRedirectUriMatches(
  marketplaceId: string,
  configuredUri: string | undefined
): string {
  const canonical = getOAuthRedirectUri(marketplaceId);
  if (configuredUri && configuredUri !== canonical) {
    throw new Error(
      `Redirect URI mismatch – check developer portal. Expected "${canonical}" but server has "${configuredUri}".`
    );
  }
  return configuredUri ?? canonical;
}

/** All marketplace redirect URIs for documentation and validation. */
export function getAllMarketplaceRedirectUris(marketplaceIds: string[]): Record<string, string> {
  return Object.fromEntries(marketplaceIds.map((id) => [id, getOAuthRedirectUri(id)]));
}
