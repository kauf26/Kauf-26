/**
 * Shopify helpers — server OAuth tokens in marketplace_auth when connected.
 */
import { env, hasEnv } from "./adapters/adapterUtils";
import {
  getAccessTokenForListingPublish,
  isMarketplaceConnectedForPublish,
} from "./listingService";
import { loadMarketplaceTokens } from "./marketplaceAuthStorage";

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

export type ShopifyProductCreateBody = {
  product: {
    title: string;
    body_html: string;
    vendor?: string;
    product_type?: string;
    status?: string;
    variants: Array<{
      sku: string;
      price: string;
      inventory_management?: string;
      inventory_quantity?: number;
    }>;
  };
};

export function isShopifyConfigured(): boolean {
  return isShopifyEnvConfigured();
}

export function isShopifyEnvConfigured(): boolean {
  return hasEnv("SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET");
}

async function resolveShopifyAuth(): Promise<{ shopDomain: string; accessToken: string }> {
  const accessToken = await getAccessTokenForListingPublish("shopify", null);
  if (!accessToken) {
    throw new Error(
      "Connect Shopify in Settings before publishing (OAuth token missing or expired)."
    );
  }

  const stored = await loadMarketplaceTokens("shopify", null);
  const shopDomain =
    stored?.shopDomain?.trim() ||
    env("SHOPIFY_SHOP_DOMAIN") ||
    (env("SHOPIFY_STORE_NAME")
      ? `${env("SHOPIFY_STORE_NAME")}.myshopify.com`
      : "");

  if (!shopDomain) {
    throw new Error("Shopify shop domain missing — reconnect with your store domain.");
  }

  return { shopDomain, accessToken };
}

export async function verifyShopifyConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  if (!isShopifyEnvConfigured()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET not set.",
    };
  }

  try {
    const { shopDomain, accessToken } = await resolveShopifyAuth();
    const res = await fetchImpl(
      `https://${shopDomain}/admin/api/2024-10/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        status: res.status,
        message: `Shopify verify failed (${res.status}).`,
      };
    }

    return {
      ok: true,
      configured: true,
      status: 200,
      message: "Shopify connected via server OAuth.",
    };
  } catch (error) {
    const connected = await isMarketplaceConnectedForPublish("shopify", null);
    return {
      ok: false,
      configured: true,
      status: connected ? 401 : 401,
      message:
        error instanceof Error
          ? error.message
          : "Connect Shopify in Settings to authorize publishing.",
    };
  }
}

export async function createShopifyProduct(
  body: ShopifyProductCreateBody,
  fetchImpl: typeof fetch = fetch
): Promise<ShopifyProductSummary & { listingUrl?: string }> {
  const { shopDomain, accessToken } = await resolveShopifyAuth();

  const res = await fetchImpl(
    `https://${shopDomain}/admin/api/2024-10/products.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new ShopifyApiError(
      `Shopify create product failed (${res.status})`,
      res.status,
      text.slice(0, 300)
    );
  }

  const json = JSON.parse(text) as {
    product?: { id?: number; title?: string; status?: string };
  };
  const id = json.product?.id;
  if (!id) {
    throw new ShopifyApiError("Shopify response missing product id", res.status, text);
  }

  return {
    id,
    title: json.product?.title ?? body.product.title,
    status: json.product?.status,
    listingUrl: `https://${shopDomain}/admin/products/${id}`,
  };
}

export async function fetchShopifyProducts(): Promise<ShopifyProductSummary[]> {
  throw new Error("Shopify listing fetch not implemented");
}
