/**
 * eBay formatting metadata only — no server-side API calls.
 * OAuth, verify, and publish run on the mobile device.
 */
import { env } from "./adapters/adapterUtils";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export function isEbaySandbox(): boolean {
  return env("EBAY_SANDBOX") === "true";
}

export function getEbayMarketplaceId(): string {
  return env("EBAY_MARKETPLACE_ID") || "EBAY_US";
}

export function getEbayCategoryId(): string {
  return env("EBAY_CATEGORY_ID") || "93427";
}

export function isEbayConfigured(): boolean {
  return false;
}

export async function verifyEbayConnection(): Promise<MarketplaceConnectionResult> {
  const hasApp =
    Boolean(env("EBAY_CLIENT_ID") || env("EBAY_APP_ID")) &&
    Boolean(env("EBAY_CLIENT_SECRET") || env("EBAY_CERT_ID"));
  if (!hasApp) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set (OAuth config for mobile only).",
    };
  }
  return {
    ok: false,
    configured: true,
    status: 0,
    message: "Connect eBay in the mobile app — tokens are stored on your device only.",
    detail: { verifyOnDevice: true },
  };
}

export type EbayInventoryListing = {
  sku: string;
  title: string;
  description: string;
  brand?: string;
  condition: string;
  price: { value: string; currency: string };
  quantity?: number;
  marketplaceId: string;
  categoryId: string;
  listingFormat: string;
};

export type EbayPublishResult = {
  listingId: string;
  offerId?: string;
  message: string;
};

/** @deprecated Server must not publish to eBay — use the mobile app. */
export async function publishEbayInventoryListing(): Promise<EbayPublishResult> {
  throw new Error("eBay publish is mobile-only — connect and publish from the app");
}

/** @deprecated Server must not refresh eBay tokens. */
export async function refreshEbayAccessToken(): Promise<string> {
  throw new Error("eBay OAuth is mobile-only");
}
