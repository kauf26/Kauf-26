import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  loadListingSession,
  saveListingSession,
  PRODUCT_LISTING_DATA_KEY,
  type ListingSession,
} from "@/lib/pendingAnalysis";
import InventoryQuantityCounter from "@/components/InventoryQuantityCounter";
import {
  MASTER_MARKETPLACES,
  SUPPORTED_MARKETPLACE_IDS,
} from "@/masterMarketplaces";
import {
  AUTO_DESCRIPTION_DISCLAIMER,
  LISTING_LIABILITY_DISCLAIMER,
  PRICE_RESPONSIBILITY_HINT,
  formatScrapedMarketAverage,
  listingDescriptionFields,
  resolveProductDescription,
} from "@shared/productDescription";
import {
  UNKNOWN_CATEGORY_WARNING,
  evaluateMarketplaceCategorySupport,
  filterSupportedMarketplaces,
  isUnknownProductCategory,
} from "@shared/marketplaceCategorySupport";
import { AutoTranslateRow } from "@/components/AutoTranslateRow";
import {
  getTranslateInternationalEnabled,
  setTranslateInternationalEnabled,
} from "@/lib/translationPrefs";

export type Marketplace = (typeof SUPPORTED_MARKETPLACE_IDS)[number];

/** UI-only display metadata keyed by canonical marketplace ID. */
const MARKETPLACE_UI_META: Record<
  Marketplace,
  { region: string; countryCode: string }
> = {
  aliexpress: { region: "China", countryCode: "CN" },
  allegro: { region: "Poland", countryCode: "PL" },
  amazon: { region: "USA", countryCode: "US" },
  bigcommerce: { region: "Global", countryCode: "GL" },
  bolcom: { region: "Netherlands", countryCode: "NL" },
  depop: { region: "UK/USA", countryCode: "UK" },
  ebay: { region: "USA", countryCode: "US" },
  etsy: { region: "USA", countryCode: "US" },
  flipkart: { region: "India", countryCode: "IN" },
  fruugo: { region: "Europe", countryCode: "GB" },
  lazada: { region: "Southeast Asia", countryCode: "SG" },
  magento: { region: "Global", countryCode: "GL" },
  mercadolibre: { region: "Latin America", countryCode: "AR" },
  mercadolibre_br: { region: "Brazil", countryCode: "BR" },
  newegg: { region: "USA", countryCode: "US" },
  poshmark: { region: "USA", countryCode: "US" },
  rakuten: { region: "Japan", countryCode: "JP" },
  shopee: { region: "Southeast Asia", countryCode: "SG" },
  shopify: { region: "Global", countryCode: "GL" },
  stockx: { region: "USA", countryCode: "US" },
  taobao: { region: "China", countryCode: "CN" },
  tiktokshop: { region: "Global", countryCode: "GL" },
  vinted: { region: "Europe", countryCode: "LV" },
  wayfair: { region: "USA", countryCode: "US" },
  woocommerce: { region: "Global", countryCode: "GL" },
  zalando: { region: "Germany", countryCode: "DE" },
};

const configById = new Map(MASTER_MARKETPLACES.map((m) => [m.id, m]));

const MARKETPLACES = SUPPORTED_MARKETPLACE_IDS.map((id) => {
  const cfg = configById.get(id);
  const meta = MARKETPLACE_UI_META[id];
  return {
    id,
    name: cfg?.name ?? id,
    currency: cfg?.currency ?? "USD",
    region: meta.region,
    countryCode: meta.countryCode,
  };
});

function readListingExtras(): { modelNumber?: string } {
  try {
    const raw = sessionStorage.getItem(PRODUCT_LISTING_DATA_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    const modelNumber = String(data.refNumber ?? data.modelNumber ?? "").trim();
    return modelNumber ? { modelNumber } : {};
  } catch {
    return {};
  }
}

function withResolvedDescription(session: ListingSession): ListingSession {
  const description = resolveProductDescription(
    session.description,
    listingDescriptionFields(session, readListingExtras())
  );
  return {
    ...session,
    description,
    product: { ...session.product, description },
  };
}

function getFlagEmoji(countryCode: string): string {
  if (countryCode === "GL") return "🌍";
  const iso = countryCode === "UK" ? "GB" : countryCode;
  if (!/^[A-Za-z]{2}$/.test(iso)) return "🌍";
  const upper = iso.toUpperCase();
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
}

const US_MARKETS = MARKETPLACES.filter(
  (m) => m.region === "USA" || m.region.includes("USA")
);
const GLOBAL_MARKETS = MARKETPLACES.filter(
  (m) => m.region !== "USA" && !m.region.includes("USA")
);

export default function SelectMarketplaces() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState<ListingSession | null>(null);
  const [selected, setSelected] = useState<Marketplace[]>(["ebay"]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishJobId, setPublishJobId] = useState<number | null>(null);
  const [translateInternational, setTranslateInternational] = useState(true);

  const draftId = useMemo(() => {
    const raw =
      sessionStorage.getItem("productDraftId") ??
      sessionStorage.getItem("identifyDraftId");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  }, []);

  useEffect(() => {
    setTranslateInternational(getTranslateInternationalEnabled());
  }, []);

  const onToggleTranslateInternational = (value: boolean) => {
    setTranslateInternational(value);
    setTranslateInternationalEnabled(value);
  };

  useEffect(() => {
    const loaded = loadListingSession();
    if (loaded) {
      const next = withResolvedDescription(loaded);
      setDraft(next);
      console.log("[SelectMarketplaces] Loaded listing:", next);
    } else {
      console.warn("[SelectMarketplaces] No listing in sessionStorage");
    }
  }, []);

  const productCategory = draft?.category ?? draft?.product.category ?? "";
  const categoryContext = useMemo(
    () => ({
      title: draft?.title,
      description: draft?.description,
    }),
    [draft?.title, draft?.description]
  );
  const unknownCategory = isUnknownProductCategory(productCategory);

  useEffect(() => {
    if (!draft) return;
    setSelected((prev) =>
      filterSupportedMarketplaces(prev, productCategory, categoryContext)
    );
  }, [draft, productCategory, categoryContext]);

  const toggle = (id: Marketplace) => {
    const support = evaluateMarketplaceCategorySupport(
      id,
      productCategory,
      categoryContext
    );
    if (!support.supported) return;

    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSupported = (markets: readonly { id: Marketplace }[]) => {
    const supported = filterSupportedMarketplaces(
      markets.map((m) => m.id),
      productCategory,
      categoryContext
    ) as Marketplace[];
    setSelected((prev) => {
      const ids = new Set([...prev, ...supported]);
      return [...ids];
    });
  };

  const updateField = (
    field: "title" | "description" | "price",
    value: string
  ) => {
    if (!draft) return;
    const next: ListingSession = {
      ...draft,
      [field]: value,
      product: { ...draft.product, [field]: value },
    };
    setDraft(next);
  };

  const renderMarketList = (
    markets: readonly {
      id: Marketplace;
      name: string;
      currency: string;
      region: string;
      countryCode: string;
    }[],
    sectionLabel?: string
  ) => {
    return (
      <div className="space-y-2">
        {sectionLabel && (
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
              {sectionLabel}
            </span>
            <button
              type="button"
              onClick={() => selectAllSupported(markets)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Select all supported
            </button>
          </div>
        )}
        {markets.map((m) => {
          const isSelected = selected.includes(m.id);
          const support = evaluateMarketplaceCategorySupport(
            m.id,
            productCategory,
            categoryContext
          );
          const isDisabled = !support.supported;

          return (
            <div
              key={m.id}
              onClick={() => !isDisabled && toggle(m.id)}
              title={
                isDisabled
                  ? support.disabledReason ?? support.policyHint
                  : undefined
              }
              className={`flex items-center justify-between gap-3 p-2 rounded-md transition-colors border ${
                isDisabled
                  ? "bg-zinc-950/80 border-zinc-800 opacity-60 cursor-not-allowed"
                  : isSelected
                    ? "bg-emerald-900/20 border-emerald-500/50 cursor-pointer"
                    : "bg-red-900/20 border-red-500/50 hover:bg-red-900/30 cursor-pointer"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium flex items-center gap-1.5 ${
                    isDisabled
                      ? "text-zinc-500 line-through"
                      : isSelected
                        ? "text-emerald-400"
                        : "text-red-200"
                  }`}
                >
                  {isDisabled && (
                    <span className="text-zinc-500 no-underline" aria-hidden>
                      🔒
                    </span>
                  )}
                  <span>
                    {getFlagEmoji(m.countryCode)} {m.name}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 uppercase">{m.id}</div>
                {isDisabled && (
                  <p className="text-[11px] text-amber-400/90 mt-1 normal-case no-underline">
                    {support.disabledReason ?? support.policyHint}
                  </p>
                )}
                {isDisabled && support.policyHint && support.disabledReason && (
                  <p className="text-[10px] text-zinc-500 mt-0.5 normal-case no-underline">
                    {support.policyHint}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                  {m.currency}
                </span>
                {isSelected && !isDisabled && (
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!draft) {
    return (
      <div className="p-8 text-center text-zinc-500 space-y-4">
        <p>No product data found. Complete the draft step first.</p>
        <button
          onClick={() => setLocation("/product-draft")}
          className="text-blue-400 hover:text-blue-300"
        >
          ← Back to Product Draft
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-zinc-100">
      <div className="flex justify-between items-center">
        <button onClick={() => setLocation("/product-draft")} className="text-zinc-400 hover:text-zinc-100">
          ← Back
        </button>
        <span className="text-xs text-zinc-500 tracking-wider">MARKETPLACE SELECTOR</span>
      </div>

      {publishError && (
        <p className="text-sm text-red-400">{publishError}</p>
      )}
      {publishJobId != null && (
        <p className="text-sm text-emerald-400">
          Publish job queued (ID {publishJobId}). Worker will process tasks shortly.
        </p>
      )}

      {draft.matchType === "exact" && (
        <p className="text-sm text-emerald-400">
          Exact marketplace match — listing fields pre-filled.
        </p>
      )}
      {draft.matchType === "similar" && (
        <p className="text-sm text-blue-300">
          Best match — similar product found; review before posting.
        </p>
      )}
      {draft.matchType === "generic" && (
        <p className="text-sm text-amber-300">
          Here's our match, please review before publishing.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">Edit Listing Details</h2>

          <div className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Brand</p>
            <p className="text-base font-semibold text-zinc-100">
              {draft.brand.trim() || "Not available"}
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Scraped Valuations
            </h3>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">eBay Market Avg</span>
              <span className="font-medium text-zinc-300">
                {formatScrapedMarketAverage(draft.product.ebayAvg)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Allegro Market Avg</span>
              <span className="font-medium text-zinc-300">
                {formatScrapedMarketAverage(draft.product.allegroAvg)}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400 mb-2">
            <div>
              <dt className="text-zinc-500">Category</dt>
              <dd>{draft.category.trim() || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Condition</dt>
              <dd>{draft.condition.trim() || "Not available"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-zinc-500">Exact match</dt>
              <dd>{draft.isExactMatch ? "Yes" : "No (similar / generic)"}</dd>
            </div>
          </dl>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Set Your Price (USD)</label>
            <input
              type="text"
              value={
                parseFloat(draft.price || "0") <= 0 ? "" : draft.price || ""
              }
              onChange={(e) => updateField("price", e.target.value)}
              placeholder={
                parseFloat(draft.price || "0") <= 0
                  ? "Price not available — enter manually"
                  : "0.00"
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
            />
            <p className="text-[11px] text-zinc-500">{PRICE_RESPONSIBILITY_HINT}</p>
            {parseFloat(draft.price || "0") <= 0 && (
              <p className="text-xs text-amber-400/90">
                Price not available — enter a price before publishing.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Description</label>
            <div
              className="rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200/90"
              role="note"
            >
              {AUTO_DESCRIPTION_DISCLAIMER}
            </div>
            <textarea
              rows={6}
              value={draft.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Auto-generated description — review and edit before publishing"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <InventoryQuantityCounter draftId={draftId} initialQuantity={1} />

          {unknownCategory && (
            <p className="text-xs text-amber-400/90 rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2">
              {UNKNOWN_CATEGORY_WARNING}
            </p>
          )}

          <div>
            <div className="text-xs font-semibold uppercase mb-2 flex gap-1 tracking-wider text-zinc-400">
              <span>🇺🇸</span> US-Based Marketplaces
            </div>
            {renderMarketList(US_MARKETS, "US channels")}
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="text-xs font-semibold uppercase mb-2 flex gap-1 tracking-wider text-zinc-400">
              <span>🌐</span> International Channels
            </div>
            <AutoTranslateRow
              checked={translateInternational}
              onCheckedChange={onToggleTranslateInternational}
              disabled={isPublishing}
              label="Auto-translate for international channels"
              labelClassName="text-zinc-400"
              className="px-1 pb-2 border-b border-zinc-800"
            />
            {renderMarketList(GLOBAL_MARKETS, "International channels")}
          </div>

          <div
            className="rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200/90"
            role="note"
          >
            {LISTING_LIABILITY_DISCLAIMER}
          </div>

          <button
            onClick={async () => {
              if (!draft || selected.length === 0) return;
              if (draftId == null) {
                setPublishError(
                  "No draft ID found. Go back to the product draft step and continue again."
                );
                return;
              }
              setIsPublishing(true);
              setPublishError(null);
              setPublishJobId(null);
              saveListingSession(draft);
              const supportedSelected = filterSupportedMarketplaces(
                selected,
                productCategory,
                categoryContext
              ) as Marketplace[];
              if (supportedSelected.length === 0) {
                setPublishError(
                  "No supported marketplaces selected for this product category."
                );
                setIsPublishing(false);
                return;
              }
              sessionStorage.setItem(
                "selectedMarkets",
                JSON.stringify(supportedSelected)
              );
              try {
                const res = await fetch("/api/marketplaces/publish", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    draftId,
                    marketplaceIds: supportedSelected,
                    translateInternational,
                    // Publish synchronously so we get listing IDs/URLs back
                    // for the confirmation page.
                    sync: true,
                  }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(
                    (body as { error?: string }).error ||
                      `Publish failed (${res.status})`
                  );
                }
                const jobId = (body as { jobId?: number }).jobId;
                if (jobId != null) {
                  setPublishJobId(jobId);
                  sessionStorage.setItem("publishJobId", String(jobId));
                }
                sessionStorage.setItem(
                  "publishReport",
                  JSON.stringify({
                    ...(body as Record<string, unknown>),
                    title: draft.title,
                  })
                );
                setLocation("/publish-confirmation");
              } catch (err) {
                setPublishError(
                  err instanceof Error ? err.message : "Publish request failed"
                );
              } finally {
                setIsPublishing(false);
              }
            }}
            disabled={selected.length === 0 || isPublishing}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 rounded transition-colors"
          >
            {isPublishing ? "Publishing…" : "Publish to Channels"}
          </button>
        </div>
      </div>
    </div>
  );
}
