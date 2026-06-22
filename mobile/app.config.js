/**
 * Expo config — validates EXPO_PUBLIC_API_URL on production/preview EAS builds.
 * @see mobile/.env.example
 */
const base = require("./app.json");

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function isProductionBuild() {
  return (
    process.env.EAS_BUILD_PROFILE === "production" ||
    process.env.APP_ENV === "production"
  );
}

function isPreviewBuild() {
  return process.env.EAS_BUILD_PROFILE === "preview";
}

function isDevelopmentBuild() {
  return process.env.EAS_BUILD_PROFILE === "development";
}

function requiresPublicEnv() {
  return isProductionBuild() || isPreviewBuild() || isDevelopmentBuild();
}

if (requiresPublicEnv() && !process.env.EXPO_PUBLIC_API_URL?.trim()) {
  throw new Error(
    "[Kauf26] EXPO_PUBLIC_API_URL is required for EAS builds. " +
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
    "[Kauf26] Legal URLs are required for EAS builds. " +
      "Set EXPO_PUBLIC_WEB_BASE_URL or both EXPO_PUBLIC_PRIVACY_URL and EXPO_PUBLIC_TERMS_URL. " +
      "See mobile/MOBILE_SUBMISSION.md."
  );
}

function includeDevClientPlugin() {
  if (isDevelopmentBuild()) return true;
  if (isPreviewBuild() || isProductionBuild()) return false;
  return true;
}

/** @param {{ config: import('expo/config').ExpoConfig }} param0 */
module.exports = ({ config }) => {
  const plugins = (config.plugins ?? base.expo.plugins ?? []).filter((plugin) => {
    if (pluginName(plugin) === "expo-dev-client" && !includeDevClientPlugin()) {
      return false;
    }
    return true;
  });

  return {
    ...config,
    plugins: [
      ...plugins,
      ["./plugins/withPrivacyManifest.js"],
      ["./plugins/withXcode26FmtFix.js"],
    ],
    extra: {
      ...(config.extra ?? {}),
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ?? "",
      eas: {
        projectId: "59f74669-28ab-41fc-8f7b-18fc9b0a5595",
        ...(config.extra?.eas ?? base.expo.extra?.eas ?? {}),
      },
    },
  };
};
