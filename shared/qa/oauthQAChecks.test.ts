/**
 * Automated pre-flight checks aligned with docs/qa/mobile-oauth-test-plan.md
 * Run: npm test -- shared/qa/
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MARKETPLACE_OAUTH_MANIFEST,
  MARKETPLACE_OAUTH_MANIFEST_COUNT,
} from "../marketplaceOAuthManifest";
import { getAllMarketplaceOAuthProviders } from "../marketplaceOAuthRegistry";
import { assertRedirectUriMatches, getOAuthRedirectUri } from "../oauthRedirect";

const REPO_ROOT = join(__dirname, "..", "..");
const APP_JSON = join(REPO_ROOT, "mobile", "app.json");
const REDIRECT_DOC = join(REPO_ROOT, "docs", "mobile-oauth-redirect-setup.md");
const QA_DOC = join(REPO_ROOT, "docs", "qa", "mobile-oauth-test-plan.md");

describe("QA Test 7 — redirect URI / native scheme", () => {
  it("app.json whitelists kauf26 scheme on iOS and Android", () => {
    const app = JSON.parse(readFileSync(APP_JSON, "utf8")) as {
      expo: {
        scheme: string;
        ios?: { infoPlist?: { CFBundleURLTypes?: unknown[] } };
        android?: { intentFilters?: unknown[] };
      };
    };
    expect(app.expo.scheme).toBe("kauf26");
    expect(app.expo.ios?.infoPlist?.CFBundleURLTypes).toBeDefined();
    expect(app.expo.android?.intentFilters?.length).toBeGreaterThan(0);
  });

  it("each marketplace uses kauf26://oauth/{id}", () => {
    for (const entry of MARKETPLACE_OAUTH_MANIFEST) {
      expect(getOAuthRedirectUri(entry.id)).toBe(`kauf26://oauth/${entry.id}`);
    }
  });
});

describe("QA Test 8 — redirect URI mismatch", () => {
  it("shows developer-portal guidance on mismatch", () => {
    expect(() => assertRedirectUriMatches("etsy", "kauf26://oauth/wrong")).toThrow(
      /Redirect URI mismatch.*developer portal/i
    );
  });
});

describe("QA Test 9 — non-OAuth marketplaces", () => {
  const nonOAuth = MARKETPLACE_OAUTH_MANIFEST.filter((m) => !m.oauthSupported);

  it("lists exactly 10 partnership / API-key marketplaces", () => {
    expect(nonOAuth).toHaveLength(10);
    expect(nonOAuth.map((m) => m.id).sort()).toEqual(
      [
        "depop",
        "fruugo",
        "magento",
        "newegg",
        "poshmark",
        "rakuten",
        "stockx",
        "tiktokshop",
        "vinted",
        "woocommerce",
      ].sort()
    );
  });
});

describe("QA Test 12 — Connections screen registry", () => {
  it("registry exposes 26 marketplaces with 16 OAuth-supported", () => {
    expect(MARKETPLACE_OAUTH_MANIFEST_COUNT).toBe(26);
    const oauthCount = MARKETPLACE_OAUTH_MANIFEST.filter((m) => m.oauthSupported).length;
    expect(oauthCount).toBe(16);
  });

  it("configured flag false when client id env missing", () => {
    const all = getAllMarketplaceOAuthProviders(() => undefined);
    expect(all).toHaveLength(26);
    expect(all.every((p) => p.configured === false)).toBe(true);
  });
});

describe("QA documentation", () => {
  it("redirect setup doc lists all 26 marketplaces", () => {
    const doc = readFileSync(REDIRECT_DOC, "utf8");
    for (const entry of MARKETPLACE_OAUTH_MANIFEST) {
      expect(doc).toContain(getOAuthRedirectUri(entry.id));
    }
  });

  it("QA test plan document exists", () => {
    const qa = readFileSync(QA_DOC, "utf8");
    expect(qa).toContain("Test 1:");
    expect(qa).toContain("Sign-off");
  });
});
