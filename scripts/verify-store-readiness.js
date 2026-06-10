#!/usr/bin/env node
/**
 * Store submission readiness validator.
 * Checks env config, optional test suite, and iOS privacy manifest.
 * Does not call EAS or deploy to remote servers.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOBILE_ROOT = path.join(ROOT, "mobile");

const GREEN = "\x1b[32m";
const RED = "\033[0;31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** @type {{ name: string; ok: boolean; detail?: string; warn?: boolean }[]} */
const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

function warn(name, detail) {
  checks.push({ name, ok: true, detail, warn: true });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = dotenv.parse(fs.readFileSync(filePath, "utf8"));
  return parsed;
}

function envGet(allEnv, key) {
  return (process.env[key] ?? allEnv[key] ?? "").trim();
}

function isSet(value) {
  return Boolean(value && value.length > 0);
}

function isPlaceholderUrl(value) {
  return /yourdomain\.com|your-api|example\.com|localhost/i.test(value);
}

console.log("\n=== Kauf26 Store Readiness Validator ===\n");

// Merge env: root .env + mobile/.env (mobile wins for EXPO_*)
const rootEnv = loadEnvFile(path.join(ROOT, ".env"));
const mobileEnv = loadEnvFile(path.join(MOBILE_ROOT, ".env"));
const merged = { ...rootEnv, ...mobileEnv };

// --- Backend .env ---
const backendRequired = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "SESSION_ENCRYPTION_KEY",
  "APP_BASE_URL",
  "CLIENT_URL",
  "OPENAI_API_KEY",
];

if (!fs.existsSync(path.join(ROOT, ".env"))) {
  fail("Backend .env file", "Missing .env — copy from .env.example");
} else {
  pass("Backend .env file", "Found .env");
}

for (const key of backendRequired) {
  const value = envGet(merged, key);
  if (!isSet(value)) {
    fail(`Backend env: ${key}`, "Not set");
  } else if (key.includes("URL") && isPlaceholderUrl(value)) {
    warn(`Backend env: ${key}`, `Set to placeholder: ${value}`);
  } else {
    pass(`Backend env: ${key}`, key.includes("SECRET") || key.includes("KEY") ? "(set)" : value.replace(/\/$/, ""));
  }
}

const mockOAuth = envGet(merged, "MOCK_OAUTH_MODE") === "true";
if (mockOAuth) {
  warn("MOCK_OAUTH_MODE", "true — not suitable for production store release");
} else {
  pass("MOCK_OAUTH_MODE", "false or unset (production mode)");
  const oauthGroups = [
    ["ETSY_CLIENT_ID", "ETSY_CLIENT_SECRET"],
    ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
  ];
  const anyOAuth = oauthGroups.some(([id, secret]) =>
    isSet(envGet(merged, id)) && isSet(envGet(merged, secret))
  );
  if (anyOAuth) {
    pass("OAuth marketplace credentials", "At least one marketplace client ID + secret configured");
  } else {
    fail("OAuth marketplace credentials", "Set Etsy, eBay, or Shopify keys (or use MOCK_OAUTH_MODE for staging only)");
  }
}

// --- Mobile env ---
const apiUrl = envGet(mobileEnv, "EXPO_PUBLIC_API_URL") || envGet(merged, "EXPO_PUBLIC_API_URL");
const webBase = envGet(mobileEnv, "EXPO_PUBLIC_WEB_BASE_URL") || envGet(merged, "EXPO_PUBLIC_WEB_BASE_URL");
const privacyUrl = envGet(mobileEnv, "EXPO_PUBLIC_PRIVACY_URL") || envGet(merged, "EXPO_PUBLIC_PRIVACY_URL");
const termsUrl = envGet(mobileEnv, "EXPO_PUBLIC_TERMS_URL") || envGet(merged, "EXPO_PUBLIC_TERMS_URL");
const hasLegal = isSet(webBase) || (isSet(privacyUrl) && isSet(termsUrl));

if (!fs.existsSync(path.join(MOBILE_ROOT, ".env"))) {
  warn("mobile/.env file", "Not found — ensure EAS Secrets are set for cloud builds");
} else {
  pass("mobile/.env file", "Found mobile/.env");
}

if (!isSet(apiUrl)) {
  fail("EXPO_PUBLIC_API_URL", "Not set in mobile/.env or environment");
} else if (isPlaceholderUrl(apiUrl)) {
  warn("EXPO_PUBLIC_API_URL", `Placeholder value: ${apiUrl}`);
} else {
  pass("EXPO_PUBLIC_API_URL", apiUrl.replace(/\/$/, ""));
}

if (!hasLegal) {
  fail(
    "Legal URLs",
    "Set EXPO_PUBLIC_WEB_BASE_URL or both EXPO_PUBLIC_PRIVACY_URL and EXPO_PUBLIC_TERMS_URL"
  );
} else if (isSet(webBase) && isPlaceholderUrl(webBase)) {
  warn("EXPO_PUBLIC_WEB_BASE_URL", `Placeholder value: ${webBase}`);
} else {
  pass("Legal URLs", webBase ? `${webBase.replace(/\/$/, "")}/privacy + /terms` : `${privacyUrl}, ${termsUrl}`);
}

const appBase = envGet(merged, "APP_BASE_URL");
if (isSet(apiUrl) && isSet(appBase) && apiUrl.replace(/\/$/, "") !== appBase.replace(/\/$/, "")) {
  warn("API URL alignment", `EXPO_PUBLIC_API_URL (${apiUrl}) differs from APP_BASE_URL (${appBase})`);
} else if (isSet(apiUrl) && isSet(appBase)) {
  pass("API URL alignment", "EXPO_PUBLIC_API_URL matches APP_BASE_URL");
}

// --- iOS Privacy Manifest ---
const privacyManifest = path.join(MOBILE_ROOT, "ios", "Kauf26", "PrivacyInfo.xcprivacy");
if (fs.existsSync(privacyManifest)) {
  pass("iOS PrivacyInfo.xcprivacy", privacyManifest);
} else {
  warn(
    "iOS PrivacyInfo.xcprivacy",
    "Not found — run: cd mobile && npx expo prebuild -p ios (or rely on EAS prebuild)"
  );
}

// --- Documentation ---
const docs = [
  "DEPLOY_BACKEND.md",
  "MANUAL_QA.md",
  "STORE_LISTING_IOS.md",
  "STORE_LISTING_ANDROID.md",
  "mobile/MOBILE_SUBMISSION.md",
  "P1_ROADMAP.md",
];
for (const doc of docs) {
  if (fs.existsSync(path.join(ROOT, doc))) {
    pass(`Doc: ${doc}`, "present");
  } else {
    fail(`Doc: ${doc}`, "missing");
  }
}

// --- Tests ---
const skipTests = process.argv.includes("--skip-tests");
if (skipTests) {
  warn("npm run test", "Skipped (--skip-tests)");
} else {
  process.stdout.write(`${DIM}Running npm run test -- --run ...${RESET}\n`);
  const result = spawnSync("npm", ["run", "test", "--", "--run"], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status === 0) {
    const match = (result.stdout || "").match(/Tests\s+(\d+ passed)/);
    pass("npm run test", match ? match[1] : "passed");
  } else {
    fail("npm run test", "Test suite failed — run npm run test -- --run for details");
  }
}

// --- Report ---
console.log("");
let failed = 0;
let warnings = 0;

for (const check of checks) {
  if (check.ok && !check.warn) {
    console.log(`${GREEN}✓${RESET} ${check.name}${check.detail ? `${DIM} — ${check.detail}${RESET}` : ""}`);
  } else if (check.warn) {
    warnings++;
    console.log(`${YELLOW}!${RESET} ${check.name}${check.detail ? `${DIM} — ${check.detail}${RESET}` : ""}`);
  } else {
    failed++;
    console.log(`${RED}✗${RESET} ${check.name}${check.detail ? `${DIM} — ${check.detail}${RESET}` : ""}`);
  }
}

console.log("");
const passed = checks.filter((c) => c.ok && !c.warn).length;
if (failed === 0) {
  console.log(`${GREEN}READY${RESET} — ${passed} passed, ${warnings} warning(s).`);
  console.log("\nManual steps remaining:");
  console.log("  • Register OAuth redirect URIs (see DEPLOY_BACKEND.md)");
  console.log("  • bash scripts/deploy-production.sh on your server");
  console.log("  • bash mobile/scripts/build-and-submit.sh (after eas login)");
  console.log("  • Complete MANUAL_QA.md and store listings");
  process.exit(warnings > 0 ? 0 : 0);
} else {
  console.log(`${RED}NOT READY${RESET} — ${failed} failed, ${warnings} warning(s), ${passed} passed.");
  process.exit(1);
}
