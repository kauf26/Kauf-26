import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import ToggleSwitch from './ToggleSwitch';

type Marketplace =
| "ebay" | "amazon" | "walmart" | "wish" | "reverb"
| "offerup" | "etsy" | "shopify" | "woocommerce"
| "aliexpress" | "mercadolibre" | "rakuten"
| "bigcommerce" | "prestashop"
| "allegro" | "bol" | "cdiscount" | "zalando"
| "mercadolibre_br" | "mercadolibre_ar"
| "lazada" | "shopee" | "flipkart"
| "gmarket" | "coupang" | "daraz" | "depop";

type ProductDraft = {
capturedImage?: string;
title: string;
description?: string;
price?: string;
};

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
       onClick={() => {
        // 1. Save selection to storage for the next page
        sessionStorage.setItem("selectedMarkets", JSON.stringify(selected));
       
        // 2. Navigate to the next stage (e.g., /create)
        setLocation("/create");
       }}
          disabled={selected.length === 0}
          className="w-full bg-emerald-600 hover:..." >
          Publish to Channels
        </button>
      </div>
    </div>
  </div>
);
}