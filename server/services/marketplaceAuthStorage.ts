import { db } from "../db";
import { marketplaceAuth } from "../../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  decryptJson,
  encryptJson,
  type EncryptedBlob,
} from "./browserAuth/encryption";

export type StoredMarketplaceTokens = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  shopDomain?: string;
  accountLabel?: string;
  metadata?: Record<string, unknown>;
};

const SUPPORTED = new Set(["etsy", "ebay", "shopify"]);

export function isSupportedMarketplaceAuth(id: string): boolean {
  return SUPPORTED.has(id.toLowerCase());
}

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

export async function saveMarketplaceTokens(
  marketplace: string,
  tokens: StoredMarketplaceTokens,
  userId: number | null
): Promise<void> {
  const id = marketplace.toLowerCase();
  if (!isSupportedMarketplaceAuth(id)) {
    throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  const encrypted = encryptJson(tokens);
  const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt) : null;

  const existing = await db
    .select({ id: marketplaceAuth.id })
    .from(marketplaceAuth)
    .where(
      userId == null
        ? and(eq(marketplaceAuth.marketplace, id), isNull(marketplaceAuth.userId))
        : and(
            eq(marketplaceAuth.marketplace, id),
            eq(marketplaceAuth.userId, userId)
          )
    );

  if (existing[0]) {
    await db
      .update(marketplaceAuth)
      .set({
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        shopDomain: tokens.shopDomain ?? null,
        accountLabel: tokens.accountLabel ?? null,
        expiresAt,
        connected: true,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceAuth.id, existing[0].id));
    return;
  }

  await db.insert(marketplaceAuth).values({
    userId,
    marketplace: id,
    encryptedPayload: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    shopDomain: tokens.shopDomain ?? null,
    accountLabel: tokens.accountLabel ?? null,
    expiresAt,
    connected: true,
  });
}

export async function loadMarketplaceTokens(
  marketplace: string,
  userId: number | null
): Promise<StoredMarketplaceTokens | null> {
  const id = marketplace.toLowerCase();
  const [row] = await db
    .select()
    .from(marketplaceAuth)
    .where(
      userId == null
        ? and(
            eq(marketplaceAuth.marketplace, id),
            isNull(marketplaceAuth.userId),
            eq(marketplaceAuth.connected, true)
          )
        : and(
            eq(marketplaceAuth.marketplace, id),
            eq(marketplaceAuth.userId, userId),
            eq(marketplaceAuth.connected, true)
          )
    );

  if (!row) return null;

  try {
    return decryptJson<StoredMarketplaceTokens>(rowToBlob(row));
  } catch (error) {
    console.error(`[marketplaceAuth] Failed to decrypt ${id} tokens:`, error);
    return null;
  }
}

export async function deleteMarketplaceTokens(
  marketplace: string,
  userId: number | null
): Promise<void> {
  const id = marketplace.toLowerCase();
  await db
    .delete(marketplaceAuth)
    .where(
      userId == null
        ? and(eq(marketplaceAuth.marketplace, id), isNull(marketplaceAuth.userId))
        : and(
            eq(marketplaceAuth.marketplace, id),
            eq(marketplaceAuth.userId, userId)
          )
    );
}

export async function listMarketplaceConnections(userId: number | null) {
  const rows = await db
    .select({
      marketplace: marketplaceAuth.marketplace,
      shopDomain: marketplaceAuth.shopDomain,
      accountLabel: marketplaceAuth.accountLabel,
      expiresAt: marketplaceAuth.expiresAt,
      connected: marketplaceAuth.connected,
      updatedAt: marketplaceAuth.updatedAt,
    })
    .from(marketplaceAuth)
    .where(
      userId == null
        ? and(isNull(marketplaceAuth.userId), eq(marketplaceAuth.connected, true))
        : and(eq(marketplaceAuth.userId, userId), eq(marketplaceAuth.connected, true))
    );

  return rows;
}

export async function hasMarketplaceConnection(
  marketplace: string,
  userId: number | null = null
): Promise<boolean> {
  const tokens = await loadMarketplaceTokens(marketplace, userId);
  return Boolean(tokens?.accessToken);
}
