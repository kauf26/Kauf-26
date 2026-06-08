/**
 * Etsy Open API v3 — shared x-api-key header (keystring:shared_secret).
 * @see https://developers.etsy.com/documentation/essentials/requests
 */

const ETSY_API_BASE = "https://api.etsy.com/v3";

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function getEtsyKeystring(): string {
  return trimEnv("ETSY_API_KEY");
}

export function getEtsySharedSecret(): string {
  return trimEnv("ETSY_SHARED_SECRET");
}

/** True when both keystring and shared secret are set in the environment. */
export function isEtsyApiKeyConfigured(): boolean {
  return Boolean(getEtsyKeystring() && getEtsySharedSecret());
}

/**
 * Etsy requires `x-api-key: keystring:shared_secret` (colon-separated).
 */
export function buildEtsyXApiKeyHeader(): string {
  const keystring = getEtsyKeystring();
  const sharedSecret = getEtsySharedSecret();
  if (!keystring || !sharedSecret) {
    throw new Error(
      "ETSY_API_KEY and ETSY_SHARED_SECRET must both be set in the environment"
    );
  }
  return `${keystring}:${sharedSecret}`;
}

export function buildEtsyApiHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return {
    "x-api-key": buildEtsyXApiKeyHeader(),
    ...extra,
  };
}

export type EtsyConnectionResult = {
  ok: boolean;
  status: number;
  applicationId?: number;
  message: string;
  raw?: unknown;
};

/** Ping Etsy Open API (no OAuth scopes required). */
export async function verifyEtsyApiConnection(
  fetchImpl: typeof fetch = fetch
): Promise<EtsyConnectionResult> {
  if (!isEtsyApiKeyConfigured()) {
    return {
      ok: false,
      status: 0,
      message:
        "Missing ETSY_API_KEY or ETSY_SHARED_SECRET — add both to .env and restart the server",
    };
  }

  const res = await fetchImpl(`${ETSY_API_BASE}/application/openapi-ping`, {
    method: "GET",
    headers: buildEtsyApiHeaders(),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `Etsy API rejected the request (${res.status})`,
      raw: json,
    };
  }

  const appId =
    typeof json === "object" &&
    json !== null &&
    "application_id" in json &&
    typeof (json as { application_id: unknown }).application_id === "number"
      ? (json as { application_id: number }).application_id
      : undefined;

  return {
    ok: true,
    status: res.status,
    applicationId: appId,
    message: "Etsy API connection successful",
    raw: json,
  };
}
