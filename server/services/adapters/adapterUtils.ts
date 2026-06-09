import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FormattedListing } from "./types";

function isUsableCredential(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("#")) return false;
  if (/^TODO\b/i.test(v)) return false;
  if (/your[-_]?store|your-site|placeholder|xxxxxxxx/i.test(v)) return false;
  return true;
}

export function env(key: string): string {
  const raw = String(process.env[key] ?? "").trim();
  return isUsableCredential(raw) ? raw : "";
}

export function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => Boolean(env(k)));
}

function parsePositivePrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * First non-zero price from draft attributes / marketPrices (publish adapters).
 */
export function draftPrice(draft: DraftPublishPayload): number {
  const a = draft.attributes ?? {};
  const market = (a.marketPrices as Record<string, unknown>) ?? {};

  const candidates: unknown[] = [
    a.recommendedPrice,
    a.medianPrice,
    market.recommendedPrice,
    a.price,
  ];

  for (const value of candidates) {
    const parsed = parsePositivePrice(value);
    if (parsed != null) return parsed;
  }

  console.warn(
    `[Publish] draft ${draft.draftId}: no price found in attributes — using 0`
  );
  return 0;
}

/** @alias draftPrice — shared price resolver for all marketplace adapters */
export function getPrice(draft: DraftPublishPayload): number {
  return draftPrice(draft);
}

function isImageRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s) return false;
  return (
    s.startsWith("data:image/") ||
    s.startsWith("http://") ||
    s.startsWith("https://")
  );
}

/**
 * Merge draft.images with attributes.capturedImage / capturedImages / page URLs.
 */
export function collectDraftImages(draft: {
  images?: unknown;
  attributes?: Record<string, unknown>;
}): string[] {
  const a = draft.attributes ?? {};
  const merged: string[] = [];
  const seen = new Set<string>();

  const add = (value: unknown) => {
    if (!isImageRef(value) || seen.has(value)) return;
    seen.add(value);
    merged.push(value);
  };

  if (Array.isArray(draft.images)) {
    for (const img of draft.images) add(img);
  }
  add(a.capturedImage);
  if (Array.isArray(a.capturedImages)) {
    for (const img of a.capturedImages) add(img);
  }
  if (Array.isArray(a.productPageImageUrls)) {
    for (const url of a.productPageImageUrls) add(url);
  }

  return merged;
}

export function draftImageCount(draft: DraftPublishPayload): number {
  return collectDraftImages(draft).length;
}

export function draftDescription(draft: DraftPublishPayload): string {
  const a = draft.attributes ?? {};
  return String(a.longDescription ?? a.aiDescription ?? draft.title);
}

export function draftSku(draft: DraftPublishPayload): string {
  return draft.sku?.trim() || `kauf26-${draft.draftId}`;
}

export function dryRunResult(
  marketplaceId: string,
  message: string,
  formatted: FormattedListing
): AdapterPublishResult {
  console.log(
    `[Publish][${marketplaceId}] dry-run payload:`,
    JSON.stringify(formatted)
  );
  return {
    dryRun: true,
    listingId: `${marketplaceId}-dry-${Date.now()}`,
    message,
  };
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}
