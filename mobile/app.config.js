/**
 * Expo config — validates EXPO_PUBLIC_API_URL on production EAS builds.
 * @see mobile/.env.example
 */
const base = require("./app.json");

function isProductionBuild() {
  return (
    process.env.EAS_BUILD_PROFILE === "production" ||
    process.env.APP_ENV === "production"
  );
}

function isPreviewBuild() {
  return process.env.EAS_BUILD_PROFILE === "preview";
}

function requiresPublicEnv() {
  return isProductionBuild() || isPreviewBuild();
}

if (requiresPublicEnv() && !process.env.EXPO_PUBLIC_API_URL?.trim()) {
  throw new Error(
    "[Kauf26] EXPO_PUBLIC_API_URL is required for production/preview builds. " +
      "Set it in eas.json (build profile env), EAS Secrets, or mobile/.env before running eas build. " +
      "See mobile/.env.example and MOBILE_SUBMISSION.md."
  );
}

for (const [key, value] of Object.entries(process.env)) {
  if (
    key.startsWith("EXPO_PUBLIC_") &&
    /SECRET|CLIENT_SECRET|APP_SECRET|PARTNER_KEY|CERT_ID/i.test(key) &&
    value?.trim()
  ) {
    throw new Error(
      `[Kauf26] ${key} must not be set in the mobile bundle. OAuth client secrets belong on the server only.`
    );
  }
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
if (isProductionBuild() && apiUrl && !apiUrl.startsWith("https://")) {
  throw new Error(
    "[Kauf26] EXPO_PUBLIC_API_URL must use HTTPS in production (e.g. https://api.yourdomain.com)"
  );
}

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
const hasLegalUrls = Boolean(webBase) || (Boolean(privacyUrl) && Boolean(termsUrl));

if (requiresPublicEnv() && !hasLegalUrls) {
  throw new Error(
    "[Kauf26] Legal URLs are required for production/preview builds. " +
      "Set EXPO_PUBLIC_WEB_BASE_URL or both EXPO_PUBLIC_PRIVACY_URL and EXPO_PUBLIC_TERMS_URL. " +
      "See mobile/MOBILE_SUBMISSION.md."
  );
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...base.expo,
    name: "Kauf26",
    plugins: [
      ...(base.expo.plugins ?? []),
      ["./plugins/withPrivacyManifest.js"],
      ["./plugins/withXcode26FmtFix.js"],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ?? "",
      eas: {
        projectId: "59f74669-28ab-41fc-8f7b-18fc9b0a5595",
        ...(base.expo.extra?.eas ?? {}),
      },
    },
  },
};
