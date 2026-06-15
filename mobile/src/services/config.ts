/**
 * API base URL for the mobile app.
 * Production builds require EXPO_PUBLIC_API_URL (validated at EAS build time in app.config.js).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

function devFallbackUrl(): string {
  // iOS Simulator / Android emulator can reach the host via localhost.
  if (Platform.OS !== 'web' && !Constants.isDevice) {
    return 'http://localhost:2626';
  }
  // Physical device — set EXPO_PUBLIC_API_URL to http://YOUR_LAN_IP:2626 in mobile/.env
  return 'http://localhost:2626';
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
  if (fromEnv) {
    const url = stripTrailingSlash(fromEnv);
    if (!isDevBuild() && !url.startsWith('https://')) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must use HTTPS in production builds (e.g. https://api.kaufai.com)'
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

  throw new Error(
    'EXPO_PUBLIC_API_URL is not configured. Set it in mobile/.env for local dev or in EAS Secrets for production builds.'
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
