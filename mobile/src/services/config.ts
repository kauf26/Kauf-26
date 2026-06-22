/**
 * API base URL for the mobile app.
 * Production builds require EXPO_PUBLIC_API_URL (validated at EAS build time in app.config.js).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isPrivateOrLocalHost(url: string): boolean {
  return /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost|127\.)/i.test(url);
}

function normalizeApiBaseUrl(url: string): string {
  let normalized = stripTrailingSlash(url);
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  return normalized;
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

function readExtraApiUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return extra?.apiUrl?.trim() || undefined;
}

function devFallbackUrl(): string {
  if (Platform.OS !== 'web' && !Constants.isDevice) {
    return 'http://localhost:2626';
  }
  return readExtraApiUrl() ?? 'http://localhost:2626';
}

function warnDevMisconfiguration(url: string): void {
  if (!isDevBuild()) return;

  if (/api\.kaufai\.com/i.test(url)) {
    console.warn(
      '[Kauf26] EXPO_PUBLIC_API_URL points at production (api.kaufai.com) while running a dev build. ' +
        'For local backend testing, set mobile/.env to http://YOUR_MAC_LAN_IP:2626 and restart Metro with --clear.'
    );
  }

  const isLocalhost = /localhost|127\.0\.0\.1/i.test(url);
  if (Constants.isDevice && isLocalhost) {
    console.warn(
      '[Kauf26] EXPO_PUBLIC_API_URL uses localhost on a physical device — the phone cannot reach your Mac via localhost. ' +
        'Use http://YOUR_MAC_LAN_IP:2626 in mobile/.env instead.'
    );
  }
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra = readExtraApiUrl();
  const raw = fromEnv || fromExtra;

  if (raw) {
    const url = normalizeApiBaseUrl(raw);
    if (!isDevBuild() && !url.startsWith('https://') && !isPrivateOrLocalHost(url)) {
      console.error(
        '[Kauf26] EXPO_PUBLIC_API_URL should use HTTPS in store builds; continuing with configured URL.'
      );
    }
    warnDevMisconfiguration(url);
    if (isDevBuild()) {
      console.log(`[Kauf26] API_BASE_URL=${url}`);
    }
    return url;
  }

  if (isDevBuild()) {
    const fallback = devFallbackUrl();
    warnDevMisconfiguration(fallback);
    console.log(`[Kauf26] API_BASE_URL=${fallback} (EXPO_PUBLIC_API_URL not set)`);
    return fallback;
  }

  const fallback = devFallbackUrl();
  console.error(
    '[Kauf26] EXPO_PUBLIC_API_URL is not configured; falling back to extra/default URL:',
    fallback
  );
  return fallback;
}

export const API_BASE_URL = resolveApiBaseUrl();
