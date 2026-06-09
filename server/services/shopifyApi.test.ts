import { describe, expect, it } from "vitest";
import {
  buildShopifyOAuthAuthorizeUrl,
  getShopifyOAuthScopes,
  isShopifyScopeApprovalError,
  parseShopifyScopeApprovalError,
  resolveShopifyOAuthAuthorizeUrl,
  resolveShopifyOAuthRedirectUri,
} from "./shopifyApi";

describe("parseShopifyScopeApprovalError", () => {
  it("parses scope from JSON errors string", () => {
    const body = JSON.stringify({
      errors:
        "[API] This action requires merchant approval for read_products scope.",
    });
    expect(parseShopifyScopeApprovalError(body)).toEqual(["read_products"]);
  });

  it("parses multiple scopes from plain text", () => {
    const body =
      "merchant approval for read_products scope and merchant approval for write_products scope";
    expect(parseShopifyScopeApprovalError(body)).toEqual([
      "read_products",
      "write_products",
    ]);
  });
});

describe("isShopifyScopeApprovalError", () => {
  it("detects 403 scope approval responses", () => {
    expect(
      isShopifyScopeApprovalError(
        403,
        '{"errors":"merchant approval for read_products scope"}'
      )
    ).toBe(true);
    expect(isShopifyScopeApprovalError(401, "Unauthorized")).toBe(false);
  });
});

describe("resolveShopifyOAuthRedirectUri", () => {
  it("defaults to local dev callback on localhost:2626", () => {
    expect(resolveShopifyOAuthRedirectUri()).toBe(
      "http://localhost:2626/api/shopify/oauth/callback"
    );
    expect(resolveShopifyOAuthAuthorizeUrl()).toBe(
      "http://localhost:2626/api/shopify/oauth/authorize"
    );
  });
});

describe("buildShopifyOAuthAuthorizeUrl", () => {
  it("returns null without redirect URI", () => {
    expect(
      buildShopifyOAuthAuthorizeUrl(
        { storeDomain: "demo.myshopify.com", clientId: "cid" },
        { redirectUri: "" }
      )
    ).toBeNull();
  });

  it("builds authorize URL with scopes and redirect", () => {
    const url = buildShopifyOAuthAuthorizeUrl(
      { storeDomain: "demo.myshopify.com", clientId: "cid" },
      {
        redirectUri: "http://localhost:2626/api/shopify/oauth/callback",
        scopes: "read_products,write_products",
        state: "test-state",
      }
    );
    expect(url).toContain("https://demo.myshopify.com/admin/oauth/authorize?");
    expect(url).toContain("client_id=cid");
    expect(url).toContain("scope=read_products%2Cwrite_products");
    expect(url).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A2626%2Fapi%2Fshopify%2Foauth%2Fcallback"
    );
    expect(url).toContain("state=test-state");
  });
});

describe("getShopifyOAuthScopes", () => {
  it("merges missing scopes with defaults", () => {
    expect(getShopifyOAuthScopes(["read_inventory"])).toContain("read_products");
    expect(getShopifyOAuthScopes(["read_inventory"])).toContain(
      "read_inventory"
    );
  });
});
