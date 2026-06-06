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

const ML_AUTH = "https://api.mercadolibre.com/oauth/token";

export function formatMercadoLibreListing(
  draft: DraftPublishPayload
): FormattedListing {
  const price = draftPrice(draft);
  return {
    marketplace: "mercadolibre",
    sku: draftSku(draft),
    site_id: env("MERCADOLIBRE_SITE_ID") || "MLA",
    imageCount: draft.images?.length ?? 0,
    apiBody: {
      title: draft.title.slice(0, 60),
      category_id: env("MERCADOLIBRE_CATEGORY_ID") || "MLA3530",
      price,
      currency_id: env("MERCADOLIBRE_CURRENCY") || "USD",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      listing_type_id: "gold_special",
      condition: String(draft.attributes?.condition ?? "used")
        .toLowerCase()
        .includes("new")
        ? "new"
        : "used",
      description: { plain_text: draftDescription(draft) },
    },
  };
}

export function isMercadoLibreConfigured(): boolean {
  return hasEnv(
    "MERCADOLIBRE_CLIENT_ID",
    "MERCADOLIBRE_CLIENT_SECRET",
    "MERCADOLIBRE_REFRESH_TOKEN"
  );
}

async function getMercadoLibreToken(
  fetchImpl: FetchFn = fetch
): Promise<string> {
  const res = await fetchImpl(ML_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("MERCADOLIBRE_CLIENT_ID"),
      client_secret: env("MERCADOLIBRE_CLIENT_SECRET"),
      refresh_token: env("MERCADOLIBRE_REFRESH_TOKEN"),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Mercado Libre OAuth failed (${res.status}): ${await res.text()}`
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function publishToMercadoLibre(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isMercadoLibreConfigured()) {
    return dryRunResult(
      "mercadolibre",
      "Mercado Libre API credentials missing — dry run only",
      formatted
    );
  }

  const token = await getMercadoLibreToken(fetchImpl);
  const res = await fetchImpl("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formatted.apiBody),
  });

  if (!res.ok) {
    throw new Error(
      `Mercado Libre API failed (${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }

  const json = (await res.json()) as { id?: string };
  return {
    message: "Mercado Libre listing created",
    listingId: json.id,
    dryRun: false,
  };
}
