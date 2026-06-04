/**
 * eBay Browse API (Finding API is decommissioned).
 * Requires EBAY_CLIENT_ID + EBAY_CLIENT_SECRET (Production keyset).
 * Falls back to EBAY_APP_ID + EBAY_CERT_ID if set.
 */
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type VisionMatchContext,
} from "./listingUtils";
import dotenv from "dotenv";

dotenv.config();

const SANDBOX = process.env.EBAY_SANDBOX === "true";
const API_ROOT = SANDBOX
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

function ebayCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = (
    process.env.EBAY_CLIENT_ID ??
    process.env.EBAY_APP_ID ??
    ""
  ).trim();
  const clientSecret = (
    process.env.EBAY_CLIENT_SECRET ??
    process.env.EBAY_CERT_ID ??
    ""
  ).trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string | null> {
  const creds = ebayCredentials();
  if (!creds) {
    console.warn(
      "[eBay] EBAY_CLIENT_ID/EBAY_CLIENT_SECRET (or APP_ID/CERT_ID) missing — skipping"
    );
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    "base64"
  );
  const res = await fetch(`${API_ROOT}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    console.error(
      `[eBay] OAuth failed (${res.status}):`,
      data.error ?? JSON.stringify(data).slice(0, 200)
    );
    return null;
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

export async function scrapeProduct(
  query: string,
  context?: VisionMatchContext
): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const url = new URL(`${API_ROOT}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(SCRAPE_LISTING_LIMIT));

  console.log(`[eBay] Browse search: ${query}`);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });

    const data = (await res.json()) as {
      itemSummaries?: Array<{
        title?: string;
        price?: { value?: string; currency?: string };
        condition?: string;
        shortDescription?: string;
        itemWebUrl?: string;
      }>;
      errors?: Array<{ message?: string }>;
    };

    if (!res.ok) {
      console.error(
        `[eBay] HTTP ${res.status}:`,
        data.errors?.[0]?.message ?? JSON.stringify(data).slice(0, 300)
      );
      return null;
    }

    const items = data.itemSummaries ?? [];
    console.log(`[eBay] Items: ${items.length}`);
    if (items[0]) {
      console.log(
        `[eBay] First:`,
        items[0].title,
        items[0].price?.value,
        items[0].price?.currency
      );
    }

    const listings = items
      .map((it) => ({
        title: String(it.title ?? "").trim(),
        brand: context?.visionBrand?.trim() ?? "",
        price: it.price?.value,
        description: String(it.shortDescription ?? "").trim(),
        category: "Watches",
        condition: String(it.condition ?? "").trim(),
        url: String(it.itemWebUrl ?? "").trim(),
      }))
      .filter((r) => r.title.length > 0);

    if (listings.length === 0) return null;

    const aggregated = aggregateListings(listings, query, context);
    if (!aggregated) return null;

    const link =
      String(aggregated.link ?? aggregated.url ?? "") ||
      items[0]?.itemWebUrl ||
      "";

    return {
      ...aggregated,
      scraperSource: "ebay",
      link,
      url: link,
    };
  } catch (err) {
    console.error("[eBay] Error:", err);
    return null;
  }
}
