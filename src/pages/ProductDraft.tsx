import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type ProductDraftState = {
isExactMatch: boolean;
title: string;
brand: string;
description: string;
price: string;
category: string;
condition: string;
modelNumber: string;
material: string;
allegroAverage: string;
ebayAverage: string;
capturedImage: string;
};

const DEFAULT_PRODUCT: ProductDraftState = {
isExactMatch: true,
title: "Draft Product Title",
brand: "Brand Name",
description: "Detailed product description goes here...",
price: "0.00",
category: "Watches",
condition: "New",
modelNumber: "N/A",
material: "N/A",
allegroAverage: "0.00",
ebayAverage: "0.00",
capturedImage: ""
};

const PROHIBITED_KEYWORDS = ["gun", "drugs", "alcohol", "tobacco", "vape", "weapon"];

const ProductDraft: React.FC = () => {
const [, setLocation] = useLocation();
const { toast } = useToast();
const [product, setProduct] = useState<ProductDraftState>(DEFAULT_PRODUCT);

// Sync with the precise data keys saved by your ProductCamera Scanner Node
useEffect(() => {
  const saved = sessionStorage.getItem("pendingAnalysis");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);

    setProduct({
      isExactMatch: true,
      title: data.title || DEFAULT_PRODUCT.title,
      brand: data.brand || DEFAULT_PRODUCT.brand,
      description: data.description || DEFAULT_PRODUCT.description,
      price: data.price || DEFAULT_PRODUCT.price,
      category: data.category || DEFAULT_PRODUCT.category,
      condition: data.condition || DEFAULT_PRODUCT.condition,
      modelNumber: data.modelNumber || DEFAULT_PRODUCT.modelNumber,
      material: data.material || DEFAULT_PRODUCT.material,
      allegroAverage: data.allegroAverage || DEFAULT_PRODUCT.allegroAverage,
      ebayAverage: data.ebayAverage || DEFAULT_PRODUCT.ebayAverage,
      capturedImage: data.capturedImage || ""
    });
  } catch (e) {
    console.error("Error parsing product draft data:", e);
  }
}, []);

const isProhibited = PROHIBITED_KEYWORDS.some(kw =>
  product.title.toLowerCase().includes(kw) || product.category.toLowerCase().includes(kw)
);

const handleContinue = async () => {
  // Construct clean layout package payload to cleanly feed step 3 (create.tsx)
  const finalData = {
    capturedImage: product.capturedImage,
    modelName: product.title,
    brand: product.brand,
    year: new Date().getFullYear(),
    condition: product.condition,
    category: product.category,
    refNumber: product.modelNumber,
    material: product.material,
    aiDescription: product.description,
    recommendedPrice: parseFloat(product.price) || 0,
    allegroAvg: parseFloat(product.allegroAverage) || 0,
    ebayAvg: parseFloat(product.ebayAverage) || 0,
  };

  sessionStorage.setItem("pendingAnalysis", JSON.stringify(finalData));

  try {
    await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: product.title,
        status: "draft",
        attributes: finalData,
      }),
    });
  } catch (err) {
    console.error("Draft sync failed (non-critical):", err);
  }

  // Move to step 3 review dashboard
  setLocation("/create");
};

const update = (field: keyof ProductDraftState, val: string) => {
  setProduct(p => ({ ...p, [field]: val }));
};

return (
  <div className="max-w-3xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 space-y-6 my-6">
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
            <span className="font-medium text-zinc-300">${product.ebayAverage}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Allegro Market Avg:</span>
            <span className="font-medium text-zinc-300">${product.allegroAverage}</span>
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
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.price} onChange={e => update("price", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Model Number</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.modelNumber} onChange={e => update("modelNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Material Composition</label>
            <input className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.material} onChange={e => update("material", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Category Node</label>
            <select className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.category} onChange={e => update("category", e.target.value)}>
              <option value="Watches">Luxury Watches</option>
              <option value="Skate Gear">Skate Gear & Apparel</option>
              <option value="Electronics">Electronics</option>
              <option value="Collectibles">Collectibles</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Item Condition</label>
            <select className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700" value={product.condition} onChange={e => update("condition", e.target.value)}>
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