import { loadPlatformTokens } from './secureTokenStore';

export type MarketplacePublishCredential = {
  accessToken: string;
  refreshToken?: string;
  shopDomain?: string;
  shopId?: string;
};

/** Load device tokens for server publish (forwarded per request, never stored server-side). */
export async function loadMarketplaceTokensForPublish(
  marketplaceIds: string[]
): Promise<Record<string, MarketplacePublishCredential>> {
  const out: Record<string, MarketplacePublishCredential> = {};

  for (const id of marketplaceIds) {
    const tokens = await loadPlatformTokens(id);
    if (!tokens?.accessToken?.trim()) continue;
    out[id] = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || undefined,
      shopDomain: tokens.shopDomain,
      shopId: tokens.shopId,
    };
  }

  return out;
}

export async function assertTokensForPublish(
  marketplaceIds: string[]
): Promise<void> {
  const missing: string[] = [];
  for (const id of marketplaceIds) {
    const tokens = await loadPlatformTokens(id);
    if (!tokens?.accessToken?.trim()) {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Connect ${missing.join(', ')} before publishing. Open Connect Marketplace in Settings or tap Connect when prompted.`
    );
  }
}
