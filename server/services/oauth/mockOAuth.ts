import type { OAuthProviderId, TokenResponse } from "./types";

const mockTokens = new Map<string, TokenResponse>();

function key(userId: number | null, provider: OAuthProviderId): string {
  return `${userId ?? "anon"}:${provider}`;
}

export function isMockOAuthMode(): boolean {
  return process.env.MOCK_OAUTH_MODE === "true";
}

export function getMockAuthUrl(
  provider: OAuthProviderId,
  state: string,
  appBaseUrl: string
): string {
  return `${appBaseUrl}/api/auth/callback?code=mock_${provider}&state=${encodeURIComponent(state)}`;
}

export function exchangeMockCode(
  provider: OAuthProviderId,
  userId: number | null
): TokenResponse {
  const tokens: TokenResponse = {
    accessToken: `mock_access_${provider}_${Date.now()}`,
    refreshToken: `mock_refresh_${provider}`,
    tokenType: "Bearer",
    scope: "mock",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    accountLabel: `Mock ${provider} account`,
    marketplaceShopId: provider === "etsy" ? "mock-shop-1" : undefined,
    shopDomain: provider === "shopify" ? "mock-store.myshopify.com" : undefined,
  };
  mockTokens.set(key(userId, provider), tokens);
  return tokens;
}

export function getMockAccessToken(
  userId: number | null,
  provider: OAuthProviderId
): string | null {
  return mockTokens.get(key(userId, provider))?.accessToken ?? `mock_access_${provider}`;
}

export function clearMockTokens(userId: number | null, provider: OAuthProviderId): void {
  mockTokens.delete(key(userId, provider));
}

export function listMockConnected(userId: number | null): OAuthProviderId[] {
  const prefix = `${userId ?? "anon"}:`;
  return [...mockTokens.keys()]
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.split(":")[1] as OAuthProviderId);
}
