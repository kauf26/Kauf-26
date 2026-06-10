#!/usr/bin/env node
/**
 * Fails fast when EXPO_PUBLIC_API_URL is missing for production builds.
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

if (!process.env.EXPO_PUBLIC_API_URL?.trim()) {
  console.error(
    "\n[Kauf26] EXPO_PUBLIC_API_URL is required for production builds.\n" +
      "  1. Copy mobile/.env.example to mobile/.env\n" +
      "  2. Set EXPO_PUBLIC_API_URL=https://your-api.example.com\n" +
      "  3. Or configure EAS Secrets: eas secret:create --name EXPO_PUBLIC_API_URL\n"
  );
  process.exit(1);
}

console.log(
  `[validate-production-env] OK — EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")}`
);
