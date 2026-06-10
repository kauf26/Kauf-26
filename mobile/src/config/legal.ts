/**
 * Legal page URLs — update after deploying the web app to production.
 * @see mobile/MOBILE_SUBMISSION.md
 */
const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, '') ??
  'https://yourdomain.com';

export const PRIVACY_POLICY_URL = `${WEB_BASE_URL}/privacy`;
export const TERMS_OF_SERVICE_URL = `${WEB_BASE_URL}/terms`;
