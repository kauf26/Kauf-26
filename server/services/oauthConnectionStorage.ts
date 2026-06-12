import { db } from "../db";
import { marketplaceConnections } from "../../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  decryptJson,
  encryptJson,
  type EncryptedBlob,
} from "./browserAuth/encryption";
import {
  isUniversalOAuthProvider,
  type OAuthProviderId,
  type TokenResponse,
} from "./oauth/types";

export type StoredConnectionTokens = TokenResponse & {
  metadata?: Record<string, unknown>;
};

function rowToBlob(row: {
  encryptedPayload: string;
  iv: string;
  authTag: string;
}): EncryptedBlob {
  return {
    ciphertext: row.encryptedPayload,
    iv: row.iv,
    authTag: row.authTag,
  };
}

function tokensToPayload(tokens: StoredConnectionTokens) {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: tokens.tokenType,
    scope: tokens.scope,
    expiresAt: tokens.expiresAt,
    shopDomain: tokens.shopDomain,
    marketplaceShopId: tokens.marketplaceShopId,
    accountLabel: tokens.accountLabel,
    metadata: tokens.metadata,
  };
}

function payloadToTokens(payload: StoredConnectionTokens): StoredConnectionTokens {
  return payload;
}

function userScope(userId: number | null) {
  return userId == null
    ? and(isNull(marketplaceConnections.userId))
    : eq(marketplaceConnections.userId, userId);
}

export async function saveConnectionTokens(
  provider: string,
  tokens: StoredConnectionTokens,
  userId: number | null
): Promise<void> {
  const id = provider.toLowerCase();
  if (!isUniversalOAuthProvider(id)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  let encrypted;
  try {
    encrypted = encryptJson(tokensToPayload(tokens));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message.includes("SESSION_ENCRYPTION_KEY")
        ? message
        : `Failed to encrypt OAuth tokens: ${message}`
    );
  }

  const tokenExpiresAt = tokens.expiresAt ? new Date(tokens.expiresAt) : null;

  let existing;
  try {
    existing = await db
      .select({ id: marketplaceConnections.id })
      .from(marketplaceConnections)
      .where(and(eq(marketplaceConnections.provider, id), userScope(userId)));

    if (existing[0]) {
      await db
        .update(marketplaceConnections)
        .set({
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          tokenExpiresAt,
          scope: tokens.scope ?? null,
          marketplaceShopId: tokens.marketplaceShopId ?? null,
          shopDomain: tokens.shopDomain ?? null,
          accountLabel: tokens.accountLabel ?? null,
          connected: true,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceConnections.id, existing[0].id));
      return;
    }

    await db.insert(marketplaceConnections).values({
      userId,
      provider: id,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      tokenExpiresAt,
      scope: tokens.scope ?? null,
      marketplaceShopId: tokens.marketplaceShopId ?? null,
      shopDomain: tokens.shopDomain ?? null,
      accountLabel: tokens.accountLabel ?? null,
      connected: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save OAuth connection to database: ${message}`);
  }
}

export async function loadConnectionTokens(
  provider: string,
  userId: number | null
): Promise<StoredConnectionTokens | null> {
  const id = provider.toLowerCase();
  const [row] = await db
    .select()
    .from(marketplaceConnections)
    .where(
      and(
        eq(marketplaceConnections.provider, id),
        userScope(userId),
        eq(marketplaceConnections.connected, true)
      )
    );

  if (!row) return null;

  try {
    return payloadToTokens(decryptJson<StoredConnectionTokens>(rowToBlob(row)));
  } catch (error) {
    console.error(`[OAuthStorage] Failed to decrypt ${id} tokens:`, error);
    return null;
  }
}

export async function deleteConnectionTokens(
  provider: string,
  userId: number | null
): Promise<void> {
  const id = provider.toLowerCase();
  await db
    .delete(marketplaceConnections)
    .where(and(eq(marketplaceConnections.provider, id), userScope(userId)));
}

export async function listConnections(userId: number | null) {
  return db
    .select({
      provider: marketplaceConnections.provider,
      shopDomain: marketplaceConnections.shopDomain,
      accountLabel: marketplaceConnections.accountLabel,
      tokenExpiresAt: marketplaceConnections.tokenExpiresAt,
      scope: marketplaceConnections.scope,
      marketplaceShopId: marketplaceConnections.marketplaceShopId,
      connected: marketplaceConnections.connected,
      updatedAt: marketplaceConnections.updatedAt,
    })
    .from(marketplaceConnections)
    .where(
      and(
        userScope(userId),
        eq(marketplaceConnections.connected, true)
      )
    );
}

export async function hasConnection(
  provider: string,
  userId: number | null = null
): Promise<boolean> {
  const tokens = await loadConnectionTokens(provider, userId);
  return Boolean(tokens?.accessToken);
}

/** @deprecated Use provider param — maps marketplace id from legacy callers. */
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

export async function listMarketplaceConnections(userId: number | null) {
  const rows = await listConnections(userId);
  return rows.map((r) => ({
    marketplace: r.provider,
    shopDomain: r.shopDomain,
    accountLabel: r.accountLabel,
    expiresAt: r.tokenExpiresAt,
    connected: r.connected,
    updatedAt: r.updatedAt,
  }));
}

export async function hasMarketplaceConnection(
  marketplace: string,
  userId: number | null = null
): Promise<boolean> {
  return hasConnection(marketplace, userId);
}

export type { OAuthProviderId };
