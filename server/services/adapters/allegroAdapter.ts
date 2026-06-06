import type { DraftPublishPayload } from "../../publishToMarketplaces";
import { draftPrice } from "./adapterUtils";
import type { AdapterPublishResult, FetchFn, FormattedListing } from "./types";

const ALLEGRO_API = "https://api.allegro.pl";
const ALLEGRO_AUTH = "https://allegro.pl/auth/oauth/token";

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function formatAllegroListing(
  draft: DraftPublishPayload
): FormattedListing {
  const a = draft.attributes ?? {};
  const pricePln = draftPrice(draft);

  return {
    name: draft.title,
    description: String(a.longDescription ?? a.aiDescription ?? draft.title),
    sellingMode: {
      format: "BUY_NOW",
      price: { amount: pricePln.toFixed(2), currency: "PLN" },
    },
    stock: { available: 1, unit: "UNIT" },
    publication: { status: "ACTIVE", duration: "P30D" },
    external: { id: draft.sku ?? `kauf26-${draft.draftId}` },
    language: "en-US",
    images: (draft.images ?? []).slice(0, 8),
    brand: a.brand ?? "",
    condition: a.condition ?? "Used",
  };
}

export function isAllegroConfigured(): boolean {
  return Boolean(env("ALLEGRO_CLIENT_ID") && env("ALLEGRO_CLIENT_SECRET"));
}

let allegroToken: { token: string; expiresAt: number } | null = null;

export async function getAllegroAccessToken(
  fetchImpl: FetchFn = fetch
): Promise<string> {
  if (allegroToken && allegroToken.expiresAt > Date.now() + 60_000) {
    return allegroToken.token;
  }

  const clientId = env("ALLEGRO_CLIENT_ID");
  const clientSecret = env("ALLEGRO_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetchImpl(ALLEGRO_AUTH, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Allegro OAuth failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  allegroToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function publishToAllegro(
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!isAllegroConfigured()) {
    console.log("[Publish][Allegro] dry-run:", JSON.stringify(formatted));
    return {
      message: "Allegro API credentials missing — dry run only",
      dryRun: true,
      listingId: `allegro-dry-${Date.now()}`,
    };
  }

  const token = await getAllegroAccessToken(fetchImpl);
  const body = {
    name: formatted.name,
    sellingMode: formatted.sellingMode,
    stock: formatted.stock,
    publication: formatted.publication,
    external: formatted.external,
    description: {
      sections: [
        {
          items: [
            {
              type: "TEXT",
              content: String(formatted.description ?? formatted.name),
            },
          ],
        },
      ],
    },
  };

  const res = await fetchImpl(`${ALLEGRO_API}/sale/product-offers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.allegro.public.v1+json",
      "Content-Type": "application/vnd.allegro.public.v1+json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Allegro create offer failed (${res.status}): ${text.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as { id?: string };
  return {
    listingId: data.id,
    message: "Allegro offer created",
    dryRun: false,
  };
}
