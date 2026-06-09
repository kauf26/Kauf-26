/**
 * Unified OAuth token lifecycle for Etsy, Shopify, and eBay.
 *
 * Tokens live in encrypted backend storage only — never sent to the frontend.
 * `userId` is reserved for future per-user credential rows; today each
 * marketplace has a single stored token set keyed by marketplace id.
 */
import { refreshEtsyTokens } from "./etsyOAuth";
import { refreshShopifyOAuthTokens } from "./shopifyOAuth";
import { refreshEbayOAuthTokens } from "./ebayOAuth";
import {
  hasStoredTokens,
  loadMarketplaceTokens,
  saveMarketplaceTokens,
  type StoredOAuthTokens,
} from "./tokenStorage";

export type OAuthMarketplace = "etsy" | "shopify" | "ebay";

export type ValidAccessToken = {
  accessToken: string;
  shopId?: string;
  shopDomain?: string;
  userId?: string;
  accountName?: string;
};

const REFRESH_BUFFER_MS = 60_000;

async function mergeAndSave(
  marketplace: OAuthMarketplace,
  refreshed: Partial<StoredOAuthTokens>,
  previous: StoredOAuthTokens | null
): Promise<StoredOAuthTokens> {
  const merged: StoredOAuthTokens = {
    accessToken: refreshed.accessToken!,
    refreshToken: refreshed.refreshToken ?? previous?.refreshToken ?? "",
    expiresAt: refreshed.expiresAt!,
    refreshExpiresAt: refreshed.refreshExpiresAt ?? previous?.refreshExpiresAt,
    shopId: refreshed.shopId ?? previous?.shopId,
    shopDomain: refreshed.shopDomain ?? previous?.shopDomain,
    userId: refreshed.userId ?? previous?.userId,
    accountName: refreshed.accountName ?? previous?.accountName,
    scope: refreshed.scope ?? previous?.scope,
  };
  await saveMarketplaceTokens(marketplace, merged);
  return merged;
}

/** Exchange a stored refresh token for a new access token and persist the result. */
export async function refreshToken(
  marketplace: OAuthMarketplace,
  _userId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<StoredOAuthTokens> {
  const stored = await loadMarketplaceTokens(marketplace);
  if (!stored?.refreshToken) {
    throw new Error(
      `${marketplace} is not connected — visit /api/${marketplace}/oauth/start`
    );
  }

  let refreshed: Partial<StoredOAuthTokens>;
  switch (marketplace) {
    case "etsy":
      refreshed = await refreshEtsyTokens(stored.refreshToken, fetchImpl);
      break;
    case "shopify":
      if (!stored.shopDomain) {
        throw new Error("Shopify shop domain missing from stored tokens — re-connect");
      }
      refreshed = await refreshShopifyOAuthTokens(
        stored.shopDomain,
        stored.refreshToken,
        fetchImpl
      );
      break;
    case "ebay":
      refreshed = await refreshEbayOAuthTokens(stored.refreshToken, fetchImpl);
      break;
    default:
      throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  return mergeAndSave(marketplace, refreshed, stored);
}

/** Return a valid access token, refreshing automatically when near expiry. */
export async function getValidAccessToken(
  marketplace: OAuthMarketplace,
  _userId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<ValidAccessToken> {
  const stored = await loadMarketplaceTokens(marketplace);
  if (!stored) {
    throw new Error(
      `${marketplace} is not connected — visit /api/${marketplace}/oauth/start`
    );
  }

  if (stored.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return {
      accessToken: stored.accessToken,
      shopId: stored.shopId,
      shopDomain: stored.shopDomain,
      userId: stored.userId,
      accountName: stored.accountName,
    };
  }

  const merged = await refreshToken(marketplace, _userId, fetchImpl);
  return {
    accessToken: merged.accessToken,
    shopId: merged.shopId,
    shopDomain: merged.shopDomain,
    userId: merged.userId,
    accountName: merged.accountName,
  };
}

export function isOAuthMarketplaceConnected(marketplace: OAuthMarketplace): boolean {
  return hasStoredTokens(marketplace);
}

/** Proactively refresh tokens that expire within the given window. */
export async function refreshExpiringTokens(
  withinMs = 10 * 60_000,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  for (const marketplace of ["etsy", "shopify", "ebay"] as const) {
    if (!hasStoredTokens(marketplace)) continue;
    try {
      const stored = await loadMarketplaceTokens(marketplace);
      if (!stored) continue;
      if (stored.expiresAt <= Date.now() + withinMs) {
        await refreshToken(marketplace, undefined, fetchImpl);
        console.log(`[tokenService] Refreshed ${marketplace} access token`);
      }
    } catch (err) {
      console.warn(`[tokenService] Failed to refresh ${marketplace}:`, err);
    }
  }
}

export function startMarketplaceTokenRefreshLoop(intervalMs = 5 * 60_000): void {
  const tick = () => {
    refreshExpiringTokens().catch((err) =>
      console.warn("[tokenService] background refresh error:", err)
    );
  };
  tick();
  setInterval(tick, intervalMs);
}
