import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";

type Marketplace =
 | "ebay" | "amazon" | "walmart" | "wish" | "reverb"
 | "offerup" | "etsy" | "shopify" | "woocommerce"
 | "aliexpress" | "mercadolibre" | "rakuten"
 | "bigcommerce" | "prestashop"
 | "allegro" | "bol" | "cdiscount" | "zalando"
 | "mercadolibre_br" | "mercadolibre_ar"
 | "lazada" | "shopee" | "flipkart"
 | "gmarket" | "coupang" | "daraz";

type ProductDraft = {
capturedImage?: string;
title: string;
description?: string;
price?: string;
};

const US_MARKETS = [
{ id: "ebay" as const, name: "eBay US", currency: "USD" },
{ id: "amazon" as const, name: "Amazon US", currency: "USD" },
{ id: "walmart" as const, name: "Walmart", currency: "USD" },
{ id: "etsy" as const, name: "Etsy", currency: "USD" },
{ id: "offerup" as const, name: "OfferUp", currency: "USD" },
{ id: "reverb" as const, name: "Reverb", currency: "USD" },
{ id: "shopify" as const, name: "Shopify", currency: "USD" },
{ id: "woocommerce" as const, name: "WooCommerce", currency: "USD" },
{ id: "bigcommerce" as const, name: "BigCommerce", currency: "USD" }
];

const GLOBAL_MARKETS = [
{ id: "prestashop" as const, name: "PrestaShop", currency: "EUR" },
{ id: "aliexpress" as const, name: "AliExpress", currency: "USD" },
{ id: "mercadolibre" as const, name: "MercadoLibre", currency: "MXN" },
{ id: "rakuten" as const, name: "Rakuten", currency: "JPY" },
{ id: "wish" as const, name: "Wish Global", currency: "USD" }
];
// Europe (4)
const EUROPE_MARKETS = [
  { id: "allegro" as const, name: "Allegro (Poland)", currency: "PLN" },
  { id: "bol" as const, name: "Bol.com (Netherlands)", currency: "EUR" },
  { id: "cdiscount" as const, name: "Cdiscount (France)", currency: "EUR" },
  { id: "zalando" as const, name: "Zalando", currency: "EUR" }
 ];
 
 // South America (2)
 const SOUTH_AMERICA_MARKETS = [
  { id: "mercadolibre_br" as const, name: "MercadoLibre Brazil", currency: "BRL" },
  { id: "mercadolibre_ar" as const, name: "MercadoLibre Argentina", currency: "ARS" }
 ];
 
 // Asia (6)
 const ASIA_MARKETS = [
  { id: "lazada" as const, name: "Lazada (SE Asia)", currency: "SGD" },
  { id: "shopee" as const, name: "Shopee (SE Asia)", currency: "USD" },
  { id: "flipkart" as const, name: "Flipkart (India)", currency: "INR" },
  { id: "gmarket" as const, name: "Gmarket (Korea)", currency: "KRW" },
  { id: "coupang" as const, name: "Coupang (Korea)", currency: "KRW" },
  { id: "daraz" as const, name: "Daraz (South Asia)", currency: "USD" }
 ];

export default function SelectMarketplaces() {
  const [, setLocation] = useLocation();
const [draft, setDraft] = useState<ProductDraft | null>(null);
const [selected, setSelected] = useState<Marketplace[]>(["ebay"]);

useEffect(() => {
  const raw = sessionStorage.getItem("pendingAnalysis");
  if (raw) {
    try {
      setDraft(JSON.parse(raw));
    } catch (e) {
      console.error("Error parsing backend analysis session data:", e);
    }
  } else {
    setDraft({ title: "Sample Product", price: "0.00", description: "" });
  }
}, []);

const toggle = (id: Marketplace) => {
  setSelected((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
};

const updateField = (field: keyof ProductDraft, value: string) => {
  if (!draft) return;
  setDraft({ ...draft, [field]: value });
};

const renderMarketList = (markets: typeof US_MARKETS | typeof GLOBAL_MARKETS) => {
  return (
    <div className="space-y-2">
      {markets.map((m) => {
        const isSelected = selected.includes(m.id);
        return (
          <Fragment key={m.id}>
            <div onClick={() => toggle(m.id)} className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-zinc-200">{m.name}</div>
                <div className="text-xs text-zinc-500 uppercase">{m.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                  {m.currency || "USD"}
                </span>
                {isSelected ? <span className="text-green-400 text-xs">● Enabled</span> : <span className="text-red-400 text-xs">○ Disabled</span>}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};

if (!draft) {
 return <div className="p-8 text-center text-zinc-500">Loading product data...</div>;
}

return (
  <div className="max-w-6xl mx-auto p-6 space-y-6 text-zinc-100">
    <div className="flex justify-between items-center">
    <button onClick={() => setLocation("/product-draft")} className="text-zinc-400 hover:text-zinc-100">
        ← Back
      </button>
      <span className="text-xs text-zinc-500 tracking-wider">MARKETPLACE SELECTOR</span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Edit Listing Details</h2>

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
          <label className="text-xs text-zinc-500">Price</label>
          <input
            type="text"
            value={draft.price || ""}
            onChange={(e) => updateField("price", e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Description</label>
          <textarea
            rows={6}
            value={draft.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
          />
        </div>
      </div>


    </div>
  </div>
);
}