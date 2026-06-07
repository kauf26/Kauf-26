import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { userMarketplaceSessions } from "@shared/schema";
import { decryptJson, encryptJson, type EncryptedBlob } from "./encryption";
import type { MarketplaceId } from "./types";

/** Playwright `storageState` shape (cookies + per-origin localStorage). */
export type BrowserSessionData = {
  cookies: Array<Record<string, unknown>>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

/**
 * AES-256-GCM encrypted browser sessions in PostgreSQL, scoped per user.
 */
export class SessionStorageService {
  async saveSession(
    userId: number,
    marketplaceId: MarketplaceId,
    sessionData: BrowserSessionData
  ): Promise<void> {
    const encrypted = encryptJson(sessionData);
    const existing = await db
      .select({ id: userMarketplaceSessions.id })
      .from(userMarketplaceSessions)
      .where(
        and(
          eq(userMarketplaceSessions.userId, userId),
          eq(userMarketplaceSessions.marketplaceId, marketplaceId)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(userMarketplaceSessions)
        .set({
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          updatedAt: new Date(),
        })
        .where(eq(userMarketplaceSessions.id, existing[0].id));
      return;
    }

    await db.insert(userMarketplaceSessions).values({
      userId,
      marketplaceId,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  }

  async loadSession(
    userId: number,
    marketplaceId: MarketplaceId
  ): Promise<BrowserSessionData | null> {
    const [row] = await db
      .select()
      .from(userMarketplaceSessions)
      .where(
        and(
          eq(userMarketplaceSessions.userId, userId),
          eq(userMarketplaceSessions.marketplaceId, marketplaceId)
        )
      )
      .limit(1);

    if (!row) return null;

    const blob: EncryptedBlob = {
      ciphertext: row.encryptedPayload,
      iv: row.iv,
      authTag: row.authTag,
    };
    return decryptJson<BrowserSessionData>(blob);
  }

  async deleteSession(userId: number, marketplaceId: MarketplaceId): Promise<void> {
    await db
      .delete(userMarketplaceSessions)
      .where(
        and(
          eq(userMarketplaceSessions.userId, userId),
          eq(userMarketplaceSessions.marketplaceId, marketplaceId)
        )
      );
  }

  async listMarketplaceIds(userId: number): Promise<MarketplaceId[]> {
    const rows = await db
      .select({ marketplaceId: userMarketplaceSessions.marketplaceId })
      .from(userMarketplaceSessions)
      .where(eq(userMarketplaceSessions.userId, userId));
    return rows.map((r) => r.marketplaceId);
  }

  async hasSession(userId: number, marketplaceId: MarketplaceId): Promise<boolean> {
    const [row] = await db
      .select({ id: userMarketplaceSessions.id })
      .from(userMarketplaceSessions)
      .where(
        and(
          eq(userMarketplaceSessions.userId, userId),
          eq(userMarketplaceSessions.marketplaceId, marketplaceId)
        )
      )
      .limit(1);
    return Boolean(row);
  }
}
