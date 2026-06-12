import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

let devFallbackEncryptionKey: Buffer | null = null;
let loggedDevEncryptionFallback = false;

function encryptionKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_ENCRYPTION_KEY is required (32-byte key as 64-char hex or base64)"
      );
    }
    if (!devFallbackEncryptionKey) {
      devFallbackEncryptionKey = randomBytes(32);
      if (!loggedDevEncryptionFallback) {
        console.warn(
          "[encryption] SESSION_ENCRYPTION_KEY not set — using ephemeral dev key (OAuth tokens will not survive server restart)"
        );
        loggedDevEncryptionFallback = true;
      }
    }
    return devFallbackEncryptionKey;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("SESSION_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return buf;
}

export type EncryptedBlob = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptJson(payload: unknown): EncryptedBlob {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptJson<T>(blob: EncryptedBlob): T {
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(blob.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
