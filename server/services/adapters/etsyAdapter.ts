import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";
import {
  draftDescription,
  draftPrice,
  draftSku,
  dryRunResult,
  env,
  hasEnv,
} from "./adapterUtils";
import { buildEtsyApiHeaders } from "../etsyApi";

const ETSY_API = "https://api.etsy.com/v3";

export function formatEtsyListing(draft: DraftPublishPayload): FormattedListing {
  const price = draftPrice(draft);
  return {
    marketplace: "etsy",
    shopId: env("ETSY_SHOP_ID"),
    sku: draftSku(draft),
    quantity: 1,
    title: draft.title,
    description: draftDescription(draft),
    price: price,
    who_made: "someone_else",
    when_made: "2020_2025",
    taxonomy_id: Number(env("ETSY_TAXONOMY_ID") || 1),
    type: "physical",
    imageCount: draft.images?.length ?? 0,
    apiBody: {
      quantity: 1,
      title: draft.title,
      description: draftDescription(draft),
      price: price,
      who_made: "someone_else",
      when_made: "2020_2025",
      taxonomy_id: Number(env("ETSY_TAXONOMY_ID") || 1),
      type: "physical",
    },
  };
}

export function isEtsyConfigured(): boolean {
  return hasEnv(
    "ETSY_API_KEY",
    "ETSY_CLIENT_ID",
    "ETSY_REFRESH_TOKEN",
    "ETSY_SHOP_ID"
  );
}

async function getEtsyAccessToken(fetchImpl: FetchFn = fetch): Promise<string> {
  const res = await fetchImpl("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("ETSY_CLIENT_ID"),
      refresh_token: env("ETSY_REFRESH_TOKEN"),
    }),
  });
  if (!res.ok) {
    throw new Error(`Etsy OAuth failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function publishToEtsy(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isEtsyConfigured()) {
    return dryRunResult(
      "etsy",
      "Etsy Open API credentials missing — dry run only",
      formatted
    );
  }

  const shopId = env("ETSY_SHOP_ID");
  const token = await getEtsyAccessToken(fetchImpl);
  const url = `${ETSY_API}/application/shops/${shopId}/listings`;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: buildEtsyApiHeaders({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(formatted.apiBody ?? formatted),
  });

  if (!res.ok) {
    throw new Error(`Etsy API failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as { listing_id?: number };
  return {
    message: "Etsy draft listing created",
    listingId: json.listing_id != null ? String(json.listing_id) : undefined,
    dryRun: false,
  };
}
