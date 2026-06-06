import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { AdapterPublishResult, FormattedListing } from "./types";

export function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => Boolean(env(k)));
}

export function draftPrice(draft: DraftPublishPayload): number {
  const a = draft.attributes ?? {};
  const market = (a.marketPrices as Record<string, string>) ?? {};
  return (
    parseFloat(market.recommendedPrice ?? String(a.medianPrice ?? "0")) || 0
  );
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
