import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  loadListingSession,
  saveListingSession,
  type ListingSession,
} from "@/lib/pendingAnalysis";

type Marketplace =
| "ebay" | "amazon" | "walmart" | "wish" | "reverb"
| "offerup" | "etsy" | "shopify" | "woocommerce"
| "aliexpress" | "mercadolibre" | "rakuten"
| "bigcommerce" | "prestashop"
| "allegro" | "bol" | "cdiscount" | "zalando"
| "mercadolibre_br" | "mercadolibre_ar"
| "lazada" | "shopee" | "flipkart"
| "gmarket" | "coupang" | "daraz" | "depop";

const US_MARKETS = [
  { id: "ebay", name: "eBay", currency: "USD" },
  { id: "amazon", name: "Amazon", currency: "USD" },
  { id: "mercari", name: "Mercari", currency: "USD" },
  { id: "mercari-jp", name: "Mercari JP", currency: "JPY" },
  { id: "stockx", name: "StockX", currency: "USD" },
  { id: "grailed", name: "Grailed", currency: "USD" },
  { id: "whatnot", name: "Whatnot", currency: "USD" },
  { id: "depop", name: "Depop", currency: "USD" },
  { id: "discogs", name: "Discogs", currency: "USD" },
  { id: "poshmark", name: "Poshmark", currency: "USD" },
 ] as const;
 
 const GLOBAL_MARKETS = [
  { id: "etsy", name: "Etsy", currency: "USD" },
  { id: "shopify", name: "Shopify", currency: "USD" },
  { id: "woocommerce", name: "WooCommerce", currency: "USD" },
  { id: "squarespace", name: "Squarespace", currency: "USD" },
  { id: "wix", name: "Wix eCommerce", currency: "USD" },
  { id: "prestashop", name: "PrestaShop", currency: "EUR" },
  { id: "mercadolibre", name: "Mercado Libre", currency: "USD" },
  { id: "pinterest", name: "Pinterest", currency: "USD" },
  { id: "tiktokshop", name: "TikTok Shop", currency: "USD" },
  { id: "vinted", name: "Vinted", currency: "EUR" },
  { id: "shopee", name: "Shopee", currency: "USD" },
  { id: "falabella", name: "Falabella", currency: "USD" },
  { id: "bolcom", name: "Bol.com", currency: "EUR" },
  { id: "allegro", name: "Allegro", currency: "PLN" },
  { id: "cdiscount", name: "Cdiscount", currency: "EUR" },
  { id: "kidizen", name: "Kidizen", currency: "USD" },
 ] as const;

function listingToProductData(draft: ListingSession) {
  return {
    title: draft.title,
    description: draft.description,
    price: draft.price,
    brand: draft.brand,
    category: draft.category,
    condition: draft.condition,
    material: draft.material ?? draft.product.material ?? "",
    color: draft.color ?? draft.product.color ?? "",
    style: draft.style ?? draft.product.style ?? "",
    capturedImage: draft.capturedImage,
    matchType: draft.matchType,
    isExactMatch: draft.isExactMatch,
    productUrl: draft.productUrl ?? draft.product.productUrl ?? "",
    allegroAvg: draft.product.allegroAvg,
    ebayAvg: draft.product.ebayAvg,
  };
}

export default function SelectMarketplaces() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState<ListingSession | null>(null);
  const [selected, setSelected] = useState<Marketplace[]>(["ebay"]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishJobId, setPublishJobId] = useState<number | null>(null);

  useEffect(() => {
    const loaded = loadListingSession();
    if (loaded) {
      setDraft(loaded);
      console.log("[SelectMarketplaces] Loaded listing:", loaded);
    } else {
      console.warn("[SelectMarketplaces] No listing in sessionStorage");
    }
  }, []);

  const toggle = (id: Marketplace) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  const renderMarketList = (markets: readonly { id: Marketplace; name: string; currency: string }[]) => {
    return (
      <div className="space-y-2">
        {markets.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <div
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`flex items-center justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors border ${
                isSelected
                  ? "bg-emerald-900/20 border-emerald-500/50"
                  : "bg-red-900/20 border-red-500/50 hover:bg-red-900/30"
              }`}
            >
              <div>
                <div className={`text-sm font-medium ${isSelected ? "text-emerald-400" : "text-red-200"}`}>
                  {m.name}
                </div>
                <div className="text-xs text-zinc-500 uppercase">{m.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                  {m.currency}
                </span>
                {isSelected && <span className="text-emerald-400 text-xs font-bold">✓</span>}
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
          No exact match found — generic description generated.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">Edit Listing Details</h2>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400 mb-2">
            <div>
              <dt className="text-zinc-500">Brand</dt>
              <dd>{draft.brand.trim() || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Category</dt>
              <dd>{draft.category.trim() || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Condition</dt>
              <dd>{draft.condition.trim() || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">eBay avg</dt>
              <dd>
                {parseFloat(draft.product.ebayAvg || "0") > 0
                  ? `$${draft.product.ebayAvg}`
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Allegro avg</dt>
              <dd>
                {parseFloat(draft.product.allegroAvg || "0") > 0
                  ? `$${draft.product.allegroAvg}`
                  : "Not available"}
              </dd>
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
            <label className="text-xs text-zinc-500">Price (USD)</label>
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
            {parseFloat(draft.price || "0") <= 0 && (
              <p className="text-xs text-amber-400/90">
                Price not available — enter a price before publishing.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Description</label>
            <textarea
              rows={6}
              value={draft.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Description from identification (exact or generic)…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <div>
            <div className="text-xs font-semibold uppercase mb-2 flex gap-1 tracking-wider text-zinc-400">
              <span>🇺🇸</span> US-Based Marketplaces
            </div>
            {renderMarketList(US_MARKETS as any)}
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <div className="text-xs font-semibold uppercase mb-2 flex gap-1 tracking-wider text-zinc-400">
              <span>🌐</span> International Channels
            </div>
            {renderMarketList(GLOBAL_MARKETS as any)}
          </div>

          <button
            onClick={async () => {
              if (!draft || selected.length === 0) return;
              setIsPublishing(true);
              setPublishError(null);
              setPublishJobId(null);
              saveListingSession(draft);
              sessionStorage.setItem("selectedMarkets", JSON.stringify(selected));
              const productData = listingToProductData(draft);
              try {
                const res = await fetch("/api/marketplaces/publish", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    productData,
                    marketplaceIds: selected,
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
                setLocation("/create");
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
            {isPublishing ? "Queuing…" : "Publish to Channels"}
          </button>
        </div>
      </div>
    </div>
  );
}
