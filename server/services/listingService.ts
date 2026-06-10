import {
  getValidAccessToken,
  type OAuthMarketplaceId,
} from "./marketplaceOAuthService";
import { hasMarketplaceConnection } from "./marketplaceAuthStorage";

const OAUTH_MARKETPLACES: OAuthMarketplaceId[] = ["etsy", "ebay", "shopify"];

export function isOAuthListingMarketplace(
  marketplaceId: string
): marketplaceId is OAuthMarketplaceId {
  return OAUTH_MARKETPLACES.includes(marketplaceId as OAuthMarketplaceId);
}

/**
 * Fetch a valid access token for publishing — never expose to the frontend.
 * Refreshes automatically when a refresh token is available.
 */
export async function getAccessTokenForListingPublish(
  marketplaceId: string,
  userId: number | null = null
): Promise<string | null> {
  if (!isOAuthListingMarketplace(marketplaceId)) return null;
  return getValidAccessToken(marketplaceId, userId);
}

export async function isMarketplaceConnectedForPublish(
  marketplaceId: string,
  userId: number | null = null
): Promise<boolean> {
  if (!isOAuthListingMarketplace(marketplaceId)) return false;
  return hasMarketplaceConnection(marketplaceId, userId);
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
