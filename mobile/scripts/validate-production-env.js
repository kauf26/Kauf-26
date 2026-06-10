#!/usr/bin/env node
/**
 * Fails fast when required production env vars are missing for EAS builds.
 * Used by npm scripts and CI before EAS build.
 */
const profile = process.env.EAS_BUILD_PROFILE || process.argv[2] || "";
const isProd =
  profile === "production" ||
  process.env.APP_ENV === "production" ||
  process.argv.includes("--production");

if (!isProd) {
  console.log("[validate-production-env] Skipping (not a production build profile).");
  process.exit(0);
}

const errors = [];

if (!process.env.EXPO_PUBLIC_API_URL?.trim()) {
  errors.push(
    "EXPO_PUBLIC_API_URL — backend API base URL (e.g. https://api.yourdomain.com)"
  );
}

const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim();

const hasLegalUrls = Boolean(webBase) || (Boolean(privacyUrl) && Boolean(termsUrl));
if (!hasLegalUrls) {
  errors.push(
    "Legal URLs — set EXPO_PUBLIC_WEB_BASE_URL (recommended) OR both EXPO_PUBLIC_PRIVACY_URL and EXPO_PUBLIC_TERMS_URL"
  );
}

if (errors.length > 0) {
  console.error("\n[Kauf26] Production build validation failed:\n");
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  console.error(
    "\n  1. Copy mobile/.env.example to mobile/.env\n" +
      "  2. Set the variables above\n" +
      "  3. Or configure EAS Secrets: eas secret:create --name EXPO_PUBLIC_API_URL --value ...\n" +
      "  See mobile/MOBILE_SUBMISSION.md\n"
  );
  process.exit(1);
}

console.log(
  `[validate-production-env] OK — EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")}`
);
if (webBase) {
  console.log(`[validate-production-env] OK — EXPO_PUBLIC_WEB_BASE_URL=${webBase.replace(/\/$/, "")}`);
} else {
  console.log(`[validate-production-env] OK — EXPO_PUBLIC_PRIVACY_URL=${privacyUrl}`);
  console.log(`[validate-production-env] OK — EXPO_PUBLIC_TERMS_URL=${termsUrl}`);
}
