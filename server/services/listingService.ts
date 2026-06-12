import {
  getValidAccessToken,
  isUniversalOAuthProvider,
  type OAuthProviderId,
} from "./oauthService";
import { hasConnection } from "./oauthConnectionStorage";
import type { ListingPolicyContext } from "../../shared/marketplaceCategorySupport";
import {
  assertMarketplacesAllowListing,
  filterAllowedMarketplaces,
} from "../../shared/marketplaceKeywordBlocker";
import {
  logPreListingPolicyWarnings,
  validatePreListingPolicies,
} from "../../shared/marketplacePolicyValidation";

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

export function extractCategoryFromDraftAttributes(
  attributes: Record<string, unknown> | undefined | null
): string {
  if (!attributes || typeof attributes !== "object") return "";
  return String(
    attributes.category ??
      attributes.categoryNode ??
      attributes.productCategory ??
      ""
  ).trim();
}

/** Validate marketplace IDs against category + keyword rules before publish. */
export function validateMarketplacesForProductCategory(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
): void {
  const { warnings } = validatePreListingPolicies(
    marketplaceIds,
    category,
    context
  );
  logPreListingPolicyWarnings(warnings);
  assertMarketplacesAllowListing(marketplaceIds, category, context);
}

/** Pre-listing validation with structured warn vs reject results. */
export function runPreListingPolicyValidation(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
) {
  const result = validatePreListingPolicies(marketplaceIds, category, context);
  logPreListingPolicyWarnings(result.warnings);
  return result;
}

/** Keep only marketplaces that accept the product category (e.g. publish-all). */
export function filterMarketplacesForProductCategory(
  marketplaceIds: readonly string[],
  category: string | undefined | null,
  context?: ListingPolicyContext
): string[] {
  return filterAllowedMarketplaces(marketplaceIds, category, context);
}
