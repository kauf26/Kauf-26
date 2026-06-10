import { describe, expect, it } from "vitest";
import { MARKETPLACE_OAUTH_MANIFEST, MARKETPLACE_OAUTH_MANIFEST_COUNT } from "./marketplaceOAuthManifest";
import {
  getAllMarketplaceOAuthProviders,
  getConfiguredOAuthProviders,
  manifestEntryToProviderConfig,
} from "./marketplaceOAuthRegistry";
import { getOAuthRedirectUri } from "./oauthRedirect";

describe("marketplace OAuth registry (26 marketplaces)", () => {
  it("manifest contains exactly 26 marketplaces", () => {
    expect(MARKETPLACE_OAUTH_MANIFEST_COUNT).toBe(26);
    expect(MARKETPLACE_OAUTH_MANIFEST).toHaveLength(26);
  });

  it("assigns kauf26://oauth/{id} redirect URI to every marketplace", () => {
    for (const entry of MARKETPLACE_OAUTH_MANIFEST) {
      const provider = manifestEntryToProviderConfig(entry, () => undefined);
      expect(provider.redirectUri).toBe(getOAuthRedirectUri(entry.id));
      expect(provider.redirectUri).toBe(`kauf26://oauth/${entry.id}`);
    }
  });

  it("simulates one-tap flow readiness for OAuth-supported providers with client id", () => {
    const env: Record<string, string> = {
      ETSY_CLIENT_ID: "etsy-key",
      EBAY_CLIENT_ID: "ebay-id",
      SHOPIFY_CLIENT_ID: "shopify-id",
      ALLEGRO_CLIENT_ID: "allegro-id",
      ALLEGRO_CLIENT_SECRET: "secret",
    };
    const readEnv = (k: string) => env[k];

    const configured = getConfiguredOAuthProviders(readEnv);
    expect(configured.map((p) => p.id)).toContain("etsy");
    expect(configured.map((p) => p.id)).toContain("ebay");
    expect(configured.map((p) => p.id)).toContain("shopify");
    expect(configured.every((p) => p.oauthSupported)).toBe(true);
    expect(configured.every((p) => p.clientId.length > 0)).toBe(true);
  });

  it("marks partnership/API-key marketplaces as not OAuth-supported", () => {
    const all = getAllMarketplaceOAuthProviders(() => undefined);
    const depop = all.find((p) => p.id === "depop");
    const fruugo = all.find((p) => p.id === "fruugo");
    expect(depop?.oauthSupported).toBe(false);
    expect(fruugo?.oauthSupported).toBe(false);
  });

  it("simulated iOS/Android browser flow config for live marketplaces", () => {
    const live = ["etsy", "ebay", "shopify"] as const;
    const env = (k: string) =>
      ({
        ETSY_CLIENT_ID: "e",
        EBAY_CLIENT_ID: "b",
        SHOPIFY_CLIENT_ID: "s",
      })[k];

    for (const id of live) {
      const p = manifestEntryToProviderConfig(
        MARKETPLACE_OAUTH_MANIFEST.find((m) => m.id === id)!,
        env
      );
      expect(p.configured).toBe(true);
      expect(p.authUrl.startsWith("https://")).toBe(true);
      expect(p.tokenUrl.startsWith("https://")).toBe(true);
      expect(p.tokenExchange).toBeTruthy();
      // System browser only — no WebView flag in config
      expect(p.oauthFlow).not.toBe("partnership");
    }
  });

  it("reports OAuth-supported count", () => {
    const supported = MARKETPLACE_OAUTH_MANIFEST.filter((m) => m.oauthSupported);
    expect(supported.length).toBeGreaterThanOrEqual(15);
    expect(supported.length).toBeLessThan(26);
  });
});
