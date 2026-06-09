/**
 * Backend-only OAuth token storage on top of the marketplace_credentials table.
 *
 * - Tokens are encrypted at rest with AES-256-GCM when ENCRYPTION_KEY is set
 *   (falls back to plaintext JSON with a startup warning otherwise).
 * - Tokens never leave the backend; routes must not echo them to the client.
 * - A small in-memory cache mirrors "which marketplaces have stored tokens"
 *   so synchronous adapter isConfigured() checks work without a DB roundtrip.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { db } from "../db";
import { marketplaceCredentials } from "../../shared/schema";
import { eq } from "drizzle-orm";

export type StoredOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when accessToken expires. */
  expiresAt: number;
  /** Epoch ms when refreshToken expires (eBay: ~18 months). */
  refreshExpiresAt?: number;
  /** Marketplace-specific identity (Etsy shop/user, Shopify store domain). */
  shopId?: string;
  shopDomain?: string;
  userId?: string;
  accountName?: string;
  scope?: string;
};

const ENC_PREFIX = "enc:v1:";

function encryptionKey(): Buffer | null {
  const raw = String(process.env.ENCRYPTION_KEY ?? "").trim();
  if (!raw) return null;
  // Accept any passphrase; derive a stable 32-byte key.
  return createHash("sha256").update(raw).digest();
}

let warnedPlaintext = false;

function encrypt(plaintext: string): string {
  const key = encryptionKey();
  if (!key) {
    if (!warnedPlaintext) {
      console.warn(
        "[tokenStorage] ENCRYPTION_KEY not set — storing OAuth tokens as plaintext JSON. Set ENCRYPTION_KEY in .env to encrypt at rest."
      );
      warnedPlaintext = true;
    }
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function decrypt(stored: string): string | null {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const key = encryptionKey();
  if (!key) {
    console.error(
      "[tokenStorage] Stored tokens are encrypted but ENCRYPTION_KEY is not set"
    );
    return null;
  }
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    console.error("[tokenStorage] Failed to decrypt stored tokens:", err);
    return null;
  }
}

/** marketplace id → tokens are present in the DB (sync mirror for adapters). */
const presenceCache = new Map<string, boolean>();

export function hasStoredTokens(marketplace: string): boolean {
  return presenceCache.get(marketplace) === true;
}

export async function saveMarketplaceTokens(
  marketplace: string,
  tokens: StoredOAuthTokens
): Promise<void> {
  const payload = encrypt(JSON.stringify(tokens));
  const existing = await db
    .select({ id: marketplaceCredentials.id })
    .from(marketplaceCredentials)
    .where(eq(marketplaceCredentials.marketplace, marketplace));

  if (existing.length > 0) {
    await db
      .update(marketplaceCredentials)
      .set({ credentials: payload, connected: true, updatedAt: new Date() })
      .where(eq(marketplaceCredentials.marketplace, marketplace));
  } else {
    await db.insert(marketplaceCredentials).values({
      marketplace,
      credentials: payload,
      connected: true,
    });
  }
  presenceCache.set(marketplace, true);
}

export async function loadMarketplaceTokens(
  marketplace: string
): Promise<StoredOAuthTokens | null> {
  try {
    const [row] = await db
      .select()
      .from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, marketplace));
    if (!row?.credentials) {
      presenceCache.set(marketplace, false);
      return null;
    }
    const json = decrypt(row.credentials);
    if (!json) return null;
    const parsed = JSON.parse(json) as Partial<StoredOAuthTokens>;
    if (!parsed.refreshToken) {
      presenceCache.set(marketplace, false);
      return null;
    }
    presenceCache.set(marketplace, true);
    return parsed as StoredOAuthTokens;
  } catch (err) {
    console.error(`[tokenStorage] load failed for ${marketplace}:`, err);
    return null;
  }
}

export async function deleteMarketplaceTokens(
  marketplace: string
): Promise<void> {
  await db
    .update(marketplaceCredentials)
    .set({ credentials: "{}", connected: false, updatedAt: new Date() })
    .where(eq(marketplaceCredentials.marketplace, marketplace));
  presenceCache.set(marketplace, false);
}

/** Call once at server startup so sync presence checks reflect the DB. */
export async function primeTokenCache(
  marketplaces: string[] = ["etsy"]
): Promise<void> {
  for (const m of marketplaces) {
    try {
      await loadMarketplaceTokens(m);
    } catch {
      presenceCache.set(m, false);
    }
  }
}
