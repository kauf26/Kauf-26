/**
 * Etsy helpers — formatting metadata only.
 * OAuth, verify, and publish run on the mobile device (expo-auth-session + SecureStore).
 */
import { env } from "./adapters/adapterUtils";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export function getEtsyClientId(): string {
  return env("ETSY_CLIENT_ID");
}

export function getEtsyShopId(): string {
  return env("ETSY_SHOP_ID");
}

export function getEtsyTaxonomyId(): number {
  return Number(env("ETSY_TAXONOMY_ID") || 1);
}

/** Server never holds Etsy tokens — always false for server-side publish. */
export function isEtsyConfigured(): boolean {
  return false;
}

export async function verifyEtsyConnection(): Promise<MarketplaceConnectionResult> {
  if (!getEtsyClientId()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "ETSY_CLIENT_ID not set in server .env (OAuth config for mobile only).",
    };
  }
  return {
    ok: false,
    configured: true,
    status: 0,
    message: "Connect Etsy in the mobile app — tokens are stored on your device only.",
    detail: { verifyOnDevice: true },
  };
}
