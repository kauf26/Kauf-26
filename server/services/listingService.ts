import {
  getValidAccessToken,
  isUniversalOAuthProvider,
  type OAuthProviderId,
} from "./oauthService";
import { hasConnection } from "./oauthConnectionStorage";

const OAUTH_MARKETPLACES: OAuthProviderId[] = ["etsy", "ebay", "shopify", "amazon"];

export function isOAuthListingMarketplace(
  marketplaceId: string
): marketplaceId is OAuthProviderId {
  return OAUTH_MARKETPLACES.includes(marketplaceId as OAuthProviderId);
}

/**
 * Fetch a valid access token for publishing — never expose to the frontend.
 * Uses concurrency-safe refresh via oauthService.
 */
export async function getAccessTokenForListingPublish(
  marketplaceId: string,
  userId: number | null = null
): Promise<string | null> {
  if (!isOAuthListingMarketplace(marketplaceId)) return null;
  return getValidAccessToken(userId, marketplaceId);
}

export async function isMarketplaceConnectedForPublish(
  marketplaceId: string,
  userId: number | null = null
): Promise<boolean> {
  if (!isUniversalOAuthProvider(marketplaceId)) return false;
  return hasConnection(marketplaceId, userId);
}

/** Validate token before publish; throws when missing or expired without refresh. */
export async function requireAccessTokenForListingPublish(
  marketplaceId: string,
  userId: number | null = null
): Promise<string> {
  const token = await getAccessTokenForListingPublish(marketplaceId, userId);
  if (!token) {
    throw new Error(
      `Connect ${marketplaceId} in Settings before publishing (OAuth token missing or expired).`
    );
  }
  return token;
}

/** Alias matching universal OAuth service naming. */
export const getValidAccessTokenForUser = getAccessTokenForListingPublish;
