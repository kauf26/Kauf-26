/**
 * API base URL for the mobile app.
 * Production builds require EXPO_PUBLIC_API_URL (validated at EAS build time in app.config.js).
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function devFallbackUrl(): string {
  // LAN IP for physical devices — override via EXPO_PUBLIC_API_URL in mobile/.env
  return "http://localhost:2626";
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

  if (isDev) {
    return devFallbackUrl();
  }

  throw new Error(
    "EXPO_PUBLIC_API_URL is not configured. Set it in mobile/.env for local dev or in EAS Secrets for production builds."
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
