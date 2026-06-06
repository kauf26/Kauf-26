import type { DraftPublishPayload } from "../../publishToMarketplaces";
import { draftPrice } from "./adapterUtils";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function formatFacebookListing(
  draft: DraftPublishPayload
): FormattedListing {
  const a = draft.attributes ?? {};
  const price = draftPrice(draft);

  return {
    retailer_id: draft.sku ?? `kauf26-${draft.draftId}`,
    name: draft.title,
    description: String(a.longDescription ?? a.aiDescription ?? draft.title),
    brand: a.brand ?? "",
    condition: mapFbCondition(String(a.condition ?? "used")),
    price: price * 100,
    currency: "USD",
    availability: "in stock",
    imageCount: draft.images?.length ?? 0,
    catalogId: env("FACEBOOK_CATALOG_ID"),
  };
}

function mapFbCondition(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("new")) return "new";
  if (c.includes("like")) return "used_like_new";
  return "used_good";
}

export function isFacebookConfigured(): boolean {
  return Boolean(env("FACEBOOK_ACCESS_TOKEN") && env("FACEBOOK_CATALOG_ID"));
}

export async function publishToFacebook(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isFacebookConfigured()) {
    console.log("[Publish][Facebook] dry-run:", JSON.stringify(formatted));
    return {
      message: "Facebook Graph token/catalog missing — dry run only",
      dryRun: true,
      listingId: `fb-dry-${Date.now()}`,
    };
  }

  const token = env("FACEBOOK_ACCESS_TOKEN");
  const catalogId = String(formatted.catalogId);
  const priceCents = Number(formatted.price ?? 0);

  const body = {
    retailer_id: formatted.retailer_id,
    name: formatted.name,
    description: formatted.description,
    brand: formatted.brand,
    condition: formatted.condition,
    price: priceCents,
    currency: formatted.currency,
    availability: formatted.availability,
    access_token: token,
  };

  const res = await fetchImpl(`${GRAPH}/${catalogId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Facebook catalog product failed (${res.status}): ${text.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as { id?: string };
  return {
    listingId: data.id,
    message: "Facebook catalog product created",
    dryRun: false,
  };
}
