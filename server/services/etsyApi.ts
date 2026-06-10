/**
 * Etsy helpers — server OAuth tokens via listingService (no env token fallback).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./adapters/adapterUtils";
import { getAccessTokenForListingPublish, isMarketplaceConnectedForPublish } from "./listingService";
import { loadMarketplaceTokens } from "./marketplaceAuthStorage";
import { UPLOADS_DIR } from "./draftPhotoUpload";
import type { FetchFn } from "./adapters/types";

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

export type EtsyPublishOptions = {
  images?: string[];
  userId?: number | null;
};

export type EtsyPublishResult = {
  listingId: string;
  listingUrl?: string;
  message: string;
  imagesUploaded: number;
};

export type EtsyImageUploadResult = {
  uploaded: number;
  errors: string[];
};

const ETSY_API = "https://api.etsy.com/v3/application";

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

/** Parse Etsy error JSON or raw body into a user-visible message. */
export function formatEtsyApiError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: string;
      error_description?: string;
      message?: string;
    };
    const detail =
      json.error_description ?? json.error ?? json.message ?? body.trim();
    return `Etsy API error (${status}): ${String(detail).slice(0, 500)}`;
  } catch {
    return `Etsy API error (${status}): ${body.slice(0, 500)}`;
  }
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

  const res = await fetchImpl(`${ETSY_API}/users/me`, {
    headers: etsyHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      configured: true,
      status: res.status,
      message: formatEtsyApiError(res.status, text),
    };
  }

  return {
    ok: true,
    configured: true,
    status: 200,
    message: "Etsy connected via server OAuth.",
  };
}

function etsyHeaders(accessToken: string): Record<string, string> {
  return {
    "x-api-key": getEtsyClientId(),
    Authorization: `Bearer ${accessToken}`,
  };
}

async function resolveEtsyShopId(
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const fromEnv = getEtsyShopId();
  if (fromEnv) return fromEnv;

  const res = await fetchImpl(`${ETSY_API}/users/me`, {
    headers: etsyHeaders(accessToken),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatEtsyApiError(res.status, text));
  }
  const json = JSON.parse(text) as { shop_id?: number };
  if (!json.shop_id) {
    throw new Error("No Etsy shop linked to this account");
  }
  return String(json.shop_id);
}

function parseDataUrl(ref: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(ref.trim());
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

function filenameForMime(mime: string, index: number): string {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return `listing-${index + 1}.${ext}`;
}

/** Resolve draft image ref to bytes for Etsy multipart upload. */
export async function resolveEtsyImageBytes(
  imageRef: string,
  fetchImpl: FetchFn = fetch
): Promise<{ buffer: Buffer; filename: string; mime: string }> {
  const dataUrl = parseDataUrl(imageRef);
  if (dataUrl) {
    return {
      buffer: dataUrl.buffer,
      filename: filenameForMime(dataUrl.mime, 0),
      mime: dataUrl.mime,
    };
  }

  if (imageRef.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), imageRef.replace(/^\//, ""));
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1) || "jpg";
    const mime =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { buffer, filename: path.basename(filePath), mime };
  }

  if (imageRef.startsWith("http://") || imageRef.startsWith("https://")) {
    const res = await fetchImpl(imageRef);
    if (!res.ok) {
      throw new Error(`Failed to fetch image (${res.status}): ${imageRef}`);
    }
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const urlName = path.basename(new URL(imageRef).pathname) || "listing.jpg";
    return { buffer, filename: urlName, mime };
  }

  const uploadsPath = path.join(UPLOADS_DIR, imageRef);
  const buffer = await fs.readFile(uploadsPath);
  return {
    buffer,
    filename: path.basename(uploadsPath),
    mime: "image/jpeg",
  };
}

/**
 * Upload images to a draft listing.
 * @see https://developer.etsy.com/documentation/reference#operation/uploadListingImage
 */
export async function uploadEtsyListingImages(
  shopId: string,
  listingId: string,
  accessToken: string,
  imageRefs: string[],
  fetchImpl: FetchFn = fetch
): Promise<EtsyImageUploadResult> {
  const errors: string[] = [];
  let uploaded = 0;

  for (let rank = 0; rank < imageRefs.length; rank++) {
    const ref = imageRefs[rank];
    try {
      const { buffer, filename, mime } = await resolveEtsyImageBytes(ref, fetchImpl);
      const form = new FormData();
      form.append("image", new Blob([buffer], { type: mime }), filename);
      form.append("rank", String(rank + 1));

      const res = await fetchImpl(
        `${ETSY_API}/shops/${shopId}/listings/${listingId}/images`,
        {
          method: "POST",
          headers: etsyHeaders(accessToken),
          body: form,
        }
      );

      const text = await res.text();
      if (!res.ok) {
        errors.push(formatEtsyApiError(res.status, text));
        continue;
      }
      uploaded++;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { uploaded, errors };
}

export async function publishEtsyListing(
  listing: EtsyListingPayload,
  options: EtsyPublishOptions = {},
  fetchImpl: FetchFn = fetch
): Promise<EtsyPublishResult> {
  const userId = options.userId ?? null;
  const accessToken = await getAccessTokenForListingPublish("etsy", userId);
  if (!accessToken) {
    throw new Error(
      "Connect Etsy in Settings before publishing (OAuth token missing or expired)."
    );
  }

  const shopId = await resolveEtsyShopId(accessToken, fetchImpl);
  const createRes = await fetchImpl(`${ETSY_API}/shops/${shopId}/listings`, {
    method: "POST",
    headers: {
      ...etsyHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(listing),
  });

  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(formatEtsyApiError(createRes.status, createText));
  }

  const created = JSON.parse(createText) as { listing_id?: number | string };
  const listingId = String(created.listing_id ?? "");
  if (!listingId) {
    throw new Error("Etsy create listing succeeded but listing_id was missing");
  }

  const imageRefs = options.images ?? [];
  let imagesUploaded = 0;
  let uploadErrors: string[] = [];

  if (imageRefs.length > 0) {
    const uploadResult = await uploadEtsyListingImages(
      shopId,
      listingId,
      accessToken,
      imageRefs,
      fetchImpl
    );
    imagesUploaded = uploadResult.uploaded;
    uploadErrors = uploadResult.errors;
  }

  if (imagesUploaded === 0 && imageRefs.length > 0) {
    throw new Error(
      `Etsy listing ${listingId} created but image upload failed: ${uploadErrors.join("; ")}`
    );
  }

  const message =
    imagesUploaded > 0
      ? `Etsy draft listing created with ${imagesUploaded} image(s)`
      : uploadErrors.length > 0
        ? `Etsy draft listing created; image warnings: ${uploadErrors.join("; ")}`
        : "Etsy draft listing created";

  return {
    listingId,
    listingUrl: `https://www.etsy.com/listing/${listingId}`,
    message,
    imagesUploaded,
  };
}

type EtsyInventoryOffering = {
  offering_id?: number;
  price?: { amount: number; divisor: number; currency_code: string };
  quantity?: number;
  is_enabled?: boolean;
  is_deleted?: boolean;
};

type EtsyInventoryProduct = {
  product_id?: number;
  sku?: string;
  property_values?: unknown[];
  offerings?: EtsyInventoryOffering[];
};

type EtsyInventoryResponse = {
  products?: EtsyInventoryProduct[];
};

/** Strip read-only fields Etsy rejects on PUT inventory updates. */
export function sanitizeEtsyInventoryForUpdate(
  inventory: EtsyInventoryResponse,
  quantity: number
): { products: Record<string, unknown>[] } {
  const products = (inventory.products ?? []).map((product) => ({
    sku: product.sku,
    property_values: product.property_values ?? [],
    offerings: (product.offerings ?? [])
      .filter((offering) => !offering.is_deleted)
      .map((offering) => ({
        price: offering.price,
        quantity,
        is_enabled: offering.is_enabled ?? true,
      })),
  }));

  return { products };
}

/**
 * Sync listing quantity via Etsy inventory API (GET then PUT full payload).
 * @see https://developer.etsy.com/documentation/reference#operation/updateListingInventory
 */
export async function syncEtsyListingInventory(
  listingId: string,
  quantity: number,
  userId: number | null = null,
  fetchImpl: FetchFn = fetch
): Promise<void> {
  const accessToken = await getAccessTokenForListingPublish("etsy", userId);
  if (!accessToken) {
    throw new Error(
      "Connect Etsy in Settings before syncing inventory (OAuth token missing or expired)."
    );
  }

  const inventoryUrl = `${ETSY_API}/listings/${listingId}/inventory`;
  const getRes = await fetchImpl(inventoryUrl, {
    headers: etsyHeaders(accessToken),
  });
  const getText = await getRes.text();
  if (!getRes.ok) {
    throw new Error(formatEtsyApiError(getRes.status, getText));
  }

  const inventory = JSON.parse(getText) as EtsyInventoryResponse;
  const body = sanitizeEtsyInventoryForUpdate(inventory, quantity);

  const putRes = await fetchImpl(inventoryUrl, {
    method: "PUT",
    headers: {
      ...etsyHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const putText = await putRes.text();
  if (!putRes.ok) {
    throw new Error(formatEtsyApiError(putRes.status, putText));
  }
}

export async function getEtsyAccountLabel(): Promise<string | null> {
  const stored = await loadMarketplaceTokens("etsy", null);
  return stored?.accountLabel ?? null;
}
