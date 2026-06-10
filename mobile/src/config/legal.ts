/**
 * Legal page URLs for in-app Settings links.
 * Production builds require EXPO_PUBLIC_WEB_BASE_URL or explicit EXPO_PUBLIC_*_URL vars.
 * @see mobile/MOBILE_SUBMISSION.md
 */

function trimUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, '') ?? '';
}

const webBase = trimUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL);
const privacyOverride = trimUrl(process.env.EXPO_PUBLIC_PRIVACY_URL);
const termsOverride = trimUrl(process.env.EXPO_PUBLIC_TERMS_URL);

/** Dev fallback when env vars are unset (never used in validated production builds). */
const DEV_WEB_BASE = 'http://localhost:5173';

const resolvedWebBase = webBase || (__DEV__ ? DEV_WEB_BASE : '');

export const PRIVACY_POLICY_URL =
  privacyOverride || (resolvedWebBase ? `${resolvedWebBase}/privacy` : '');

export const TERMS_OF_SERVICE_URL =
  termsOverride || (resolvedWebBase ? `${resolvedWebBase}/terms` : '');

export function hasProductionLegalUrls(): boolean {
  if (privacyOverride && termsOverride) return true;
  if (webBase) return true;
  return false;
}
