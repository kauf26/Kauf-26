/**
 * Etsy helpers — server OAuth tokens in marketplace_auth when connected.
 */
import { env } from "./adapters/adapterUtils";
import {
  getAccessTokenForListingPublish,
  isMarketplaceConnectedForPublish,
} from "./listingService";
import { loadMarketplaceTokens } from "./marketplaceAuthStorage";

export type MarketplaceConnectionResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  detail?: unknown;
};

export type EtsyListingPayload = {
  quantity: number;
  title: string;
  description: string;
  price: number;
  who_made: string;
  when_made: string;
  taxonomy_id: number;
  type: string;
};

export type EtsyPublishResult = {
  listingId: string;
  listingUrl?: string;
  message: string;
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

export function isEtsyConfigured(): boolean {
  return Boolean(getEtsyClientId());
}

export async function verifyEtsyConnection(
  fetchImpl: typeof fetch = fetch
): Promise<MarketplaceConnectionResult> {
  if (!getEtsyClientId()) {
    return {
      ok: false,
      configured: false,
      status: 0,
      message: "ETSY_CLIENT_ID not set in server .env.",
    };
  }

  const token = await getAccessTokenForListingPublish("etsy", null);
  if (!token) {
    const connected = await isMarketplaceConnectedForPublish("etsy", null);
    return {
      ok: connected,
      configured: true,
      status: connected ? 200 : 401,
      message: connected
        ? "Etsy connected via server OAuth."
        : "Connect Etsy in Settings to authorize publishing.",
    };
  }

  const res = await fetchImpl("https://api.etsy.com/v3/application/users/me", {
    headers: {
      "x-api-key": getEtsyClientId(),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      configured: true,
      status: res.status,
      message: `Etsy token verification failed (${res.status}).`,
    };
  }

  return {
    ok: true,
    configured: true,
    status: 200,
    message: "Etsy connected via server OAuth.",
  };
}

async function resolveEtsyShopId(
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const fromEnv = getEtsyShopId();
  if (fromEnv) return fromEnv;

  const res = await fetchImpl("https://api.etsy.com/v3/application/users/me", {
    headers: {
      "x-api-key": getEtsyClientId(),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Etsy shop lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { shop_id?: number };
  if (!json.shop_id) {
    throw new Error("No Etsy shop linked to this account");
  }
  return String(json.shop_id);
}

export async function publishEtsyListing(
  listing: EtsyListingPayload,
  fetchImpl: typeof fetch = fetch
): Promise<EtsyPublishResult> {
  const accessToken = await getAccessTokenForListingPublish("etsy", null);
  if (!accessToken) {
    throw new Error("Connect Etsy in Settings before publishing (OAuth token missing or expired).");
  }

  const shopId = await resolveEtsyShopId(accessToken, fetchImpl);
  const res = await fetchImpl(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: {
        "x-api-key": getEtsyClientId(),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listing),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Etsy create listing failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text) as { listing_id?: number | string };
  const listingId = String(json.listing_id ?? "");
  return {
    listingId,
    listingUrl: listingId ? `https://www.etsy.com/listing/${listingId}` : undefined,
    message: "Etsy draft listing created",
  };
}

export async function getEtsyAccountLabel(): Promise<string | null> {
  const stored = await loadMarketplaceTokens("etsy", null);
  return stored?.accountLabel ?? null;
}
