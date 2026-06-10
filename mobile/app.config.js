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

if (isProductionBuild() && !process.env.EXPO_PUBLIC_API_URL?.trim()) {
  throw new Error(
    "[Kauf26] EXPO_PUBLIC_API_URL is required for production builds. " +
      "Set it in EAS Secrets or mobile/.env before running eas build --profile production. " +
      "See mobile/.env.example and MOBILE_SUBMISSION.md."
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
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ?? "",
      eas: base.expo.extra?.eas,
    },
  },
};
