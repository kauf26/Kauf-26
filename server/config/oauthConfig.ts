/**
 * Public OAuth metadata for mobile clients.
 * No secrets, no tokens — mobile performs OAuth and stores tokens in Keychain.
 */
import { getOAuthRedirectUri } from "../../shared/oauthRedirect";
import { env } from "../services/adapters/adapterUtils";

export type MarketplaceOAuthConfig = {
  marketplace: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Shopify only: merchant enters store domain in the app before connecting. */
  requiresShopDomain?: boolean;
};

function appBaseUrl(): string {
  return (env("APP_BASE_URL") || "http://localhost:2626").replace(/\/$/, "");
}

export function getMarketplaceOAuthConfigs(): MarketplaceOAuthConfig[] {
  const base = appBaseUrl();
  const configs: MarketplaceOAuthConfig[] = [];

  const etsyClientId = env("ETSY_CLIENT_ID");
  if (etsyClientId) {
    const redirectUri = env("ETSY_REDIRECT_URI") || getOAuthRedirectUri("etsy");
    configs.push({
      marketplace: "etsy",
      clientId: etsyClientId,
      scopes:
        env("ETSY_OAUTH_SCOPES") ||
        "email_r listings_r listings_w shops_r shops_w",
      redirectUri,
      authorizeUrl: "https://www.etsy.com/oauth/connect",
      tokenUrl: "https://api.etsy.com/v3/public/oauth/token",
    });
  }

  const shopifyClientId = env("SHOPIFY_CLIENT_ID");
  if (shopifyClientId) {
    configs.push({
      marketplace: "shopify",
      clientId: shopifyClientId,
      scopes: env("SHOPIFY_OAUTH_SCOPES") || "read_products,write_products",
      redirectUri: env("SHOPIFY_OAUTH_REDIRECT_URI") || getOAuthRedirectUri("shopify"),
      authorizeUrl: "https://{shop}/admin/oauth/authorize",
      tokenUrl: "https://{shop}/admin/oauth/access_token",
      requiresShopDomain: true,
    });
  }

  const ebayClientId = env("EBAY_CLIENT_ID") || env("EBAY_APP_ID");
  if (ebayClientId) {
    const sandbox = env("EBAY_SANDBOX") === "true";
    configs.push({
      marketplace: "ebay",
      clientId: ebayClientId,
      scopes:
        env("EBAY_OAUTH_SCOPES") ||
        "https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
      redirectUri: env("EBAY_REDIRECT_URI") || getOAuthRedirectUri("ebay"),
      authorizeUrl: sandbox
        ? "https://auth.sandbox.ebay.com/oauth2/authorize"
        : "https://auth.ebay.com/oauth2/authorize",
      tokenUrl: sandbox
        ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
        : "https://api.ebay.com/identity/v1/oauth2/token",
    });
  }

  return configs;
}

export function getOAuthConfigFor(
  marketplace: string
): MarketplaceOAuthConfig | undefined {
  return getMarketplaceOAuthConfigs().find((c) => c.marketplace === marketplace);
}
