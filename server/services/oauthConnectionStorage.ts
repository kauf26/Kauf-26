/**
 * @deprecated Marketplace OAuth tokens are not persisted on the server.
 * Device holds tokens (mobile SecureStore); publish forwards tokens per request.
 */
import type { TokenResponse } from "./oauth/types";

export type StoredConnectionTokens = TokenResponse & {
  metadata?: Record<string, unknown>;
};

export async function saveConnectionTokens(
  _provider: string,
  _tokens: StoredConnectionTokens,
  _userId: number | null
): Promise<void> {
  console.warn(
    "[OAuthStorage] saveConnectionTokens is disabled — tokens are not stored on the server."
  );
}

export async function loadConnectionTokens(
  _provider: string,
  _userId: number | null
): Promise<StoredConnectionTokens | null> {
  return null;
}

export async function deleteConnectionTokens(
  _provider: string,
  _userId: number | null
): Promise<void> {
  // No-op — nothing persisted
}

export async function listConnections(_userId: number | null) {
  return [];
}

export async function hasConnection(
  _provider: string,
  _userId: number | null = null
): Promise<boolean> {
  return false;
}

export async function saveMarketplaceTokens(
  marketplace: string,
  tokens: StoredConnectionTokens,
  userId: number | null
): Promise<void> {
  return saveConnectionTokens(marketplace, tokens, userId);
}

export async function loadMarketplaceTokens(
  marketplace: string,
  userId: number | null
): Promise<StoredConnectionTokens | null> {
  return loadConnectionTokens(marketplace, userId);
}

export async function deleteMarketplaceTokens(
  marketplace: string,
  userId: number | null
): Promise<void> {
  return deleteConnectionTokens(marketplace, userId);
}

export async function listMarketplaceConnections(_userId: number | null) {
  return [];
}

export async function hasMarketplaceConnection(
  _marketplace: string,
  _userId: number | null = null
): Promise<boolean> {
  return false;
}

export type { OAuthProviderId } from "./oauth/types";
