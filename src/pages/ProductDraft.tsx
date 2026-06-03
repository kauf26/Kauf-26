import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  parseListingSession,
  saveListingSession,
  type ListingSession,
  type MatchType,
} from "@/lib/pendingAnalysis";

type ProductDraftState = {
isExactMatch: boolean;
matchType: MatchType;
title: string;
brand: string;
description: string;
price: string;
category: string;
condition: string;
modelNumber: string;
material: string;
color: string;
allegroAverage: string;
ebayAverage: string;
capturedImage: string;
};

/** Suggestions only — user can type any category (e.g. Cameras, Shoes) */
const CATEGORY_SUGGESTIONS = [
  "Electronics",
  "Watches",
  "Clothing",
  "Shoes",
  "Accessories",
  "Home",
  "Home & Kitchen",
  "Kitchenware",
  "Collectibles",
  "Skate Gear",
  "Cameras",
  "Other",
];

const DEFAULT_PRODUCT: ProductDraftState = {
isExactMatch: false,
matchType: "generic",
title: "Draft Product Title",
brand: "",
description: "Detailed product description goes here...",
price: "0.00",
category: "",
condition: "New",
modelNumber: "N/A",
material: "",
color: "",
allegroAverage: "0.00",
ebayAverage: "0.00",
capturedImage: ""
};

const PROHIBITED_KEYWORDS = ["gun", "drugs", "alcohol", "tobacco", "vape", "weapon"];

function formatPrice(value: string): string {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(2) : value || "0.00";
}

function isPriceUnset(value: string): boolean {
  const n = parseFloat(value);
  return !Number.isFinite(n) || n <= 0;
}

function formatPriceDisplay(value: string): string {
  if (isPriceUnset(value)) return "Price not available";
  return `$${formatPrice(value)}`;
}

function formatMarketAvg(value: string): string {
  if (isPriceUnset(value)) return "—";
  return `$${formatPrice(value)}`;
}

function normalizeConditionForSelect(condition: string): string {
  const c = condition.trim().toLowerCase();
  if (!c || c === "n/a") return "Used";
  if (c === "like new" || c === "like-new" || c === "mint") return "Like New";
  if (c === "new" || c === "brand new") return "New";
  if (c === "used" || c === "pre-owned") return "Used";
  if (c === "fair" || c === "vintage") return "Fair";
  const options = ["New", "Like New", "Used", "Fair"];
  const match = options.find((o) => o.toLowerCase() === c);
  return match ?? "Used";
}

function sanitizeBrandDisplay(brand: string): string {
  const s = brand.trim();
  return s.toUpperCase() === "N/A" ? "" : s;
}

const ProductDraft: React.FC = () => {
const [, setLocation] = useLocation();
const { toast } = useToast();
const [product, setProduct] = useState<ProductDraftState>(DEFAULT_PRODUCT);

useEffect(() => {
  const saved = sessionStorage.getItem("pendingAnalysis");
  if (!saved) return;

  try {
    const listing = parseListingSession(JSON.parse(saved));
    if (!listing) return;

    setProduct({
      isExactMatch: listing.isExactMatch ?? DEFAULT_PRODUCT.isExactMatch,
      matchType:
        listing.matchType ??
        (listing.isExactMatch ? "exact" : "generic"),
      title: listing.title,
      brand: sanitizeBrandDisplay(listing.brand),
      description: listing.description,
      price: listing.price,
      category: listing.category || DEFAULT_PRODUCT.category,
      condition: normalizeConditionForSelect(listing.condition),
      modelNumber: DEFAULT_PRODUCT.modelNumber,
      material: (listing.material ?? listing.product.material ?? "").trim(),
      color: (listing.color ?? listing.product.color ?? "").trim(),
      allegroAverage: listing.product.allegroAvg,
      ebayAverage: listing.product.ebayAvg,
      capturedImage: listing.capturedImage,
    });
  } catch (e) {
    console.error("Error parsing product draft data:", e);
  }
}, []);


const isProhibited = PROHIBITED_KEYWORDS.some(kw =>
  product.title.toLowerCase().includes(kw) || product.category.toLowerCase().includes(kw)
);

const handleContinue = async () => {
  const listing: ListingSession = {
    title: product.title,
    description: product.description,
    price: product.price,
    brand: product.brand,
    category: product.category,
    condition: product.condition,
    material: product.material,
    color: product.color,
    capturedImage: product.capturedImage,
    isExactMatch: product.isExactMatch,
    matchType: product.matchType,
    product: {
      title: product.title,
      description: product.description,
      price: product.price,
      brand: product.brand,
      category: product.category,
      condition: product.condition,
      material: product.material,
      color: product.color,
      capturedImage: product.capturedImage,
      allegroAvg: product.allegroAverage,
      ebayAvg: product.ebayAverage,
      isExactMatch: product.isExactMatch,
      matchType: product.matchType,
    },
  };
  saveListingSession(listing);

  try {
    await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: product.title,
        status: "draft",
        attributes: {
          capturedImage: product.capturedImage,
          modelName: product.title,
          brand: product.brand,
          condition: product.condition,
          category: product.category,
          aiDescription: product.description,
          recommendedPrice: parseFloat(product.price) || 0,
          allegroAvg: parseFloat(product.allegroAverage) || 0,
          ebayAvg: parseFloat(product.ebayAverage) || 0,
        },
      }),
    });
  } catch (err) {
    console.error("Draft sync failed (non-critical):", err);
  }

  setLocation("/select-marketplaces");
};

const update = (field: keyof ProductDraftState, val: string) => {
  setProduct(p => ({ ...p, [field]: val }));
};

return (
  <div className="max-w-3xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 space-y-6 my-6">
    {product.matchType === "exact" ? (
      <div
        className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 flex items-center gap-2"
        role="status"
      >
        <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          Exact Match Confirmed
        </span>
        <p className="text-sm text-emerald-200/90">
          Listing data came from a validated marketplace match.
        </p>
      </div>
    ) : product.matchType === "similar" ? (
      <div
        className="rounded-lg border border-blue-700/50 bg-blue-950/30 px-4 py-3"
        role="status"
      >
        <p className="text-sm font-medium text-blue-200">
          Best match — similar product found; review before posting.
        </p>
        <p className="text-xs text-blue-200/70 mt-1">
          Marketplace data is from a comparable listing, not an exact SKU match.
        </p>
      </div>
    ) : (
      <div
        className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3"
        role="alert"
      >
        <p className="text-sm font-medium text-amber-200">
          No exact match found — generic description generated.
        </p>
        <p className="text-xs text-amber-200/70 mt-1">
          Confirm title, brand, price, category, and condition before posting.
        </p>
      </div>
    )}

    <section className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Identified product
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Title</dt>
          <dd className="font-medium text-zinc-100">{product.title || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Brand</dt>
          <dd className="font-medium text-zinc-100">{product.brand || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Price</dt>
          <dd className="font-medium text-zinc-100">{formatPriceDisplay(product.price)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Category</dt>
          <dd className="font-medium text-zinc-100">{product.category || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Condition</dt>
          <dd className="font-medium text-zinc-100">{product.condition || "—"}</dd>
        </div>
      </dl>
    </section>

    <div>
      <h1 className="text-2xl font-bold text-zinc-100">Product Draft</h1>
      <p className="text-xs text-zinc-500">Refine the automatically extracted product metadata specifications below.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: Image Preview & Marketplace Estimates */}
      <div className="space-y-4">
        <div className="border border-zinc-800 rounded bg-zinc-950 p-2 flex items-center justify-center min-h-[200px]">
          {product.capturedImage ? (
            <img src={product.capturedImage} alt="Product Match" className="w-full h-auto rounded object-cover" />
          ) : (
            <span className="text-xs text-zinc-600">No Image Preview Available</span>
          )}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded p-4 space-y-3">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Scraped Valuations</h3>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">eBay Market Avg:</span>
            <span className="font-medium text-zinc-300">{formatMarketAvg(product.ebayAverage)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Allegro Market Avg:</span>
            <span className="font-medium text-zinc-300">{formatMarketAvg(product.allegroAverage)}</span>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Fields */}
      <div className="md:col-span-2 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Exact Match Title</label>
          <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.title} onChange={e => update("title", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Brand</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.brand} onChange={e => update("brand", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Target Listing Price ($)</label>
            <input
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              value={isPriceUnset(product.price) ? "" : product.price}
              onChange={e => update("price", e.target.value)}
              placeholder={isPriceUnset(product.price) ? "Price not available — enter manually" : "0.00"}
            />
            {isPriceUnset(product.price) && (
              <p className="text-xs text-amber-400/90">Price not available — set manually before posting.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Model Number</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.modelNumber} onChange={e => update("modelNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Material Composition</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.material} onChange={e => update("material", e.target.value)} placeholder="e.g. ceramic, cotton" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Color</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.color} onChange={e => update("color", e.target.value)} placeholder="e.g. white and blue" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Category Node</label>
            <input
              list="category-suggestions"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              value={product.category}
              onChange={e => update("category", e.target.value)}
              placeholder="e.g. Home & Kitchen, Electronics"
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Item Condition</label>
            <select className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={normalizeConditionForSelect(product.condition)} onChange={e => update("condition", e.target.value)}>
              <option value="New">New / Unworn</option>
              <option value="Like New">Like New / Mint</option>
              <option value="Used">Used / Light Wear</option>
              <option value="Fair">Fair / Vintage</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <textarea rows={4} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none" value={product.description} onChange={e => update("description", e.target.value)} />
        </div>
      </div>
    </div>

    {isProhibited ? (
      <div className="w-full py-3 bg-red-600/20 border border-red-700 text-red-400 font-semibold text-center rounded text-sm tracking-wide">
        🛑 PROHIBITED KEYWORD DETECTED — UNABLE TO SYNDICATE LISTING
      </div>
    ) : (
      <button className="w-full bg-blue-600 text-white font-semibold py-3 rounded hover:bg-blue-500 transition-colors text-sm" onClick={handleContinue}>
        Continue to Marketplaces & Post
      </button>
    )}
  </div>
);
};

export default ProductDraft;