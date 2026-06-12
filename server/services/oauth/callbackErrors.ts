/**
 * Classify OAuth callback failures for JSON responses and mobile deep links.
 */
export type OAuthCallbackErrorKind =
  | "session_encryption"
  | "client_secret"
  | "database"
  | "oauth_provider"
  | "session"
  | "unknown";

export type OAuthCallbackErrorInfo = {
  kind: OAuthCallbackErrorKind;
  message: string;
  status: number;
};

export function classifyOAuthCallbackError(error: unknown): OAuthCallbackErrorInfo {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.trim() || "OAuth callback failed";
  const lower = message.toLowerCase();

  if (
    lower.includes("session_encryption_key") ||
    lower.includes("encryption key") ||
    lower.includes("must decode to 32 bytes")
  ) {
    return {
      kind: "session_encryption",
      message:
        "SESSION_ENCRYPTION_KEY is missing or invalid — set a 32-byte key in .env",
      status: 500,
    };
  }

  if (
    lower.includes("client_secret") ||
    lower.includes("_client_secret is not configured") ||
    lower.includes("client secret")
  ) {
    return {
      kind: "client_secret",
      message: `OAuth client secret not configured: ${message}`,
      status: 400,
    };
  }

  if (
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("database") ||
    lower.includes("insert") ||
    lower.includes("violates") ||
    lower.includes("marketplace_connections")
  ) {
    return {
      kind: "database",
      message: `Failed to save OAuth connection: ${message}`,
      status: 500,
    };
  }

  if (
    lower.includes("oauth session expired") ||
    lower.includes("invalid oauth state") ||
    lower.includes("missing authorization code")
  ) {
    return { kind: "session", message, status: 400 };
  }

  if (
    lower.includes("token exchange") ||
    lower.includes("refresh failed") ||
    lower.includes("oauth failed")
  ) {
    return { kind: "oauth_provider", message, status: 400 };
  }

  return { kind: "unknown", message, status: 500 };
}

export function logOAuthCallbackError(
  scope: string,
  error: unknown,
  info: OAuthCallbackErrorInfo
): void {
  console.error(`[OAuth] ${scope} failed (${info.kind}):`, info.message);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  } else if (error != null) {
    console.error(error);
  }
}
