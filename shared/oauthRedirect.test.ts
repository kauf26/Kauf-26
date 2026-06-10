import { describe, expect, it } from "vitest";
import {
  OAUTH_APP_SCHEME,
  OAUTH_CALLBACK_PREFIX,
  OAUTH_REDIRECT_URIS,
  assertRedirectUriMatches,
  getOAuthRedirectUri,
  isOAuthCallbackUrl,
} from "./oauthRedirect";

describe("oauthRedirect", () => {
  it("uses canonical redirect URIs for each marketplace", () => {
    expect(getOAuthRedirectUri("etsy")).toBe("kauf26://oauth/etsy");
    expect(getOAuthRedirectUri("shopify")).toBe("kauf26://oauth/shopify");
    expect(getOAuthRedirectUri("ebay")).toBe("kauf26://oauth/ebay");
    expect(OAUTH_REDIRECT_URIS.etsy).toBe(`${OAUTH_APP_SCHEME}://oauth/etsy`);
  });

  it("detects OAuth callback deep links", () => {
    expect(isOAuthCallbackUrl("kauf26://oauth/etsy?code=abc")).toBe(true);
    expect(isOAuthCallbackUrl("kauf26://oauth/shopify")).toBe(true);
    expect(isOAuthCallbackUrl("https://example.com/oauth/etsy")).toBe(false);
    expect(isOAuthCallbackUrl(null)).toBe(false);
    expect(OAUTH_CALLBACK_PREFIX).toBe("kauf26://oauth/");
  });

  it("accepts matching server redirect URIs", () => {
    expect(assertRedirectUriMatches("ebay", "kauf26://oauth/ebay")).toBe("kauf26://oauth/ebay");
    expect(assertRedirectUriMatches("etsy", undefined)).toBe("kauf26://oauth/etsy");
  });

  it("rejects mismatched server redirect URIs", () => {
    expect(() => assertRedirectUriMatches("etsy", "kauf26://oauth/wrong")).toThrow(/mismatch/i);
  });
});
