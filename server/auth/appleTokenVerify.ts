import { createPublicKey, verify } from "node:crypto";

type AppleJwk = {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
};

type AppleJwks = { keys: AppleJwk[] };

let cachedKeys: AppleJwks | null = null;
let cachedAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchAppleJwks(): Promise<AppleJwks> {
  if (cachedKeys && Date.now() - cachedAt < JWKS_TTL_MS) {
    return cachedKeys;
  }
  const res = await fetch("https://appleid.apple.com/auth/keys");
  if (!res.ok) {
    throw new Error("Failed to fetch Apple public keys");
  }
  cachedKeys = (await res.json()) as AppleJwks;
  cachedAt = Date.now();
  return cachedKeys;
}

function base64UrlToBuffer(value: string): Buffer {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function jwkToPem(jwk: AppleJwk): string {
  if (!jwk.n || !jwk.e) {
    throw new Error("Invalid Apple JWK");
  }
  const keyObject = createPublicKey({
    key: { kty: "RSA", n: jwk.n, e: jwk.e },
    format: "jwk",
  });
  return keyObject.export({ type: "spki", format: "pem" }) as string;
}

export type VerifiedAppleIdentity = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
};

/** Verify Sign in with Apple identity token (JWT) from the native iOS/Android SDK. */
export async function verifyAppleIdentityToken(
  identityToken: string,
  clientId: string
): Promise<VerifiedAppleIdentity> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple identity token");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlToBuffer(headerB64).toString("utf8")) as {
    kid?: string;
    alg?: string;
  };
  const payload = JSON.parse(base64UrlToBuffer(payloadB64).toString("utf8")) as {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
  };

  if (payload.iss !== "https://appleid.apple.com") {
    throw new Error("Invalid Apple token issuer");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(clientId)) {
    throw new Error("Apple token audience mismatch");
  }

  if (!payload.sub) {
    throw new Error("Apple token missing subject");
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error("Apple identity token expired");
  }

  const jwks = await fetchAppleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error("Apple signing key not found");
  }

  const pem = jwkToPem(jwk);
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBuffer(signatureB64);
  const valid = verify("RSA-SHA256", data, pem, signature);
  if (!valid) {
    throw new Error("Apple identity token signature invalid");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
  };
}
