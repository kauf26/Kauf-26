import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type {
  AdapterPublishResult,
  FetchFn,
  FormattedListing,
  MarketplaceAdapter,
} from "./types";
import {
  draftDescription,
  draftImageCount,
  draftPrice,
  draftSku,
  dryRunResult,
  env,
  hasEnv,
  postJson,
} from "./adapterUtils";

export type OpenRestAdapterSpec = {
  id: string;
  displayName: string;
  envKeys: string[];
  buildPayload: (draft: DraftPublishPayload) => FormattedListing;
  publishUrl: (formatted: FormattedListing) => string;
  buildHeaders?: (formatted: FormattedListing) => Record<string, string>;
  extractListingId?: (json: unknown) => string | undefined;
  missingCredsMessage: string;
};

export function createOpenRestAdapter(
  spec: OpenRestAdapterSpec
): MarketplaceAdapter {
  return {
    id: spec.id,
    format: spec.buildPayload,
    isConfigured: () => hasEnv(...spec.envKeys),
    publish: (formatted, fetchImpl?: FetchFn) =>
      publishOpenRest(spec, formatted, fetchImpl),
  };
}

async function publishOpenRest(
  spec: OpenRestAdapterSpec,
  formatted: FormattedListing,
  fetchImpl: FetchFn = fetch
): Promise<AdapterPublishResult> {
  if (!hasEnv(...spec.envKeys)) {
    return dryRunResult(spec.id, spec.missingCredsMessage, formatted);
  }

  const url = spec.publishUrl(formatted);
  const headers = spec.buildHeaders?.(formatted) ?? {
    Authorization: `Bearer ${env(spec.envKeys[0])}`,
  };

  const { ok, status, json, text } = await postJson(
    url,
    formatted.apiBody ?? formatted,
    headers,
    fetchImpl
  );

  if (!ok) {
    throw new Error(
      `${spec.displayName} API failed (${status}): ${text.slice(0, 200)}`
    );
  }

  const listingId =
    spec.extractListingId?.(json) ??
    (json as { id?: string; listing_id?: string }).id ??
    (json as { listing_id?: string }).listing_id;

  return {
    message: `${spec.displayName} listing created`,
    listingId: listingId ?? `${spec.id}-${Date.now()}`,
    dryRun: false,
  };
}

export function baseOpenPayload(
  draft: DraftPublishPayload,
  marketplaceId: string,
  extra: Record<string, unknown> = {}
): FormattedListing {
  const a = draft.attributes ?? {};
  return {
    marketplace: marketplaceId,
    title: draft.title,
    description: draftDescription(draft),
    price: draftPrice(draft),
    sku: draftSku(draft),
    category: a.category ?? "",
    brand: a.brand ?? "",
    condition: a.condition ?? "Used",
    images: draft.images ?? [],
    imageCount: draftImageCount(draft),
    ...extra,
  };
}
