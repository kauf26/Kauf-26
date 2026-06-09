/**
 * Shopify formatting metadata only — no server-side Admin API calls.
 * OAuth, verify, and publish run on the mobile device.
 */
import { env, hasEnv } from "./adapters/adapterUtils";

export type ShopifyConfig = {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
};

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export type ShopifyProductSummary = {
  id: number;
  title: string;
  status?: string;
};

export function isShopifyConfigured(): boolean {
  return false;
}

export function isShopifyEnvConfigured(): boolean {
  return hasEnv("SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET");
}

export async function verifyShopifyConnection(): Promise<MarketplaceConnectionResult> {
  if (!isShopifyEnvConfigured()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET not set (OAuth config for mobile only).",
    };
  }
  return {
    ok: false,
    configured: true,
    status: 0,
    message: "Connect Shopify in the mobile app — tokens are stored on your device only.",
    detail: { verifyOnDevice: true },
  };
}

/** @deprecated Server must not call Shopify Admin API. */
export async function resolveShopifyConfigFromEnv(): Promise<ShopifyConfig> {
  throw new Error("Shopify API is mobile-only");
}

/** @deprecated Server must not create Shopify products. */
export async function createShopifyProduct(): Promise<ShopifyProductSummary> {
  throw new Error("Shopify publish is mobile-only");
}

/** @deprecated Server must not fetch Shopify products. */
export async function fetchShopifyProducts(): Promise<ShopifyProductSummary[]> {
  throw new Error("Shopify verify is mobile-only");
}
