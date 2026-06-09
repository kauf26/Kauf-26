import type { ReactElement } from "react";
import { useLocation } from "wouter";

const SLIDES = [
  "upload",
  "analyze",
  "listings",
  "sales",
  "dashboard",
];

function UploadSlide() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="border-b border-white/10 bg-[#0f0f1a] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-blue-500">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 14L2 8z"/></svg>
          </div>
          <span className="font-bold text-white">Global Lister</span>
        </div>
        <div className="flex gap-1">
          {["Upload","Dashboard","Listings","Sales","Tools","Connections"].map(l => (
            <div key={l} className={`px-2 py-1 rounded text-xs ${l === "Upload" ? "bg-blue-600 text-white" : "text-gray-400"}`}>{l}</div>
          ))}
        </div>
      </nav>

      <div className="bg-blue-600/10 border-b border-blue-500/20 px-4 py-2 text-center text-sm text-blue-300">
        <span>Free trial: <strong>28 days remaining</strong> — 2% fee applies after trial</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">List Anything, Everywhere</h1>
          <p className="text-gray-400 text-base">Photograph your product and AI instantly creates listings for 14+ global marketplaces</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="border-2 border-dashed border-blue-500/40 rounded-2xl p-10 bg-blue-500/5 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Take or Upload a Photo</p>
              <p className="text-gray-400 text-sm mt-1">AI analyzes your product instantly</p>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold text-base">
              Open Camera
            </button>
            <button className="w-full border border-white/10 text-gray-300 py-3 px-6 rounded-xl font-medium text-base">
              Choose from Library
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
          {["eBay","Amazon","Etsy","Shopify","Walmart","Mercado Libre"].map(m => (
            <div key={m} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
              <span className="text-xs text-gray-400">{m}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-xs">+ 8 more marketplaces · Auto translation · Currency conversion</p>
      </div>
    </div>
  );
}

function AnalyzeSlide() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="border-b border-white/10 bg-[#0f0f1a] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-blue-500"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 14L2 8z"/></svg></div>
          <span className="font-bold text-white">Global Lister</span>
        </div>
        <span className="text-sm text-gray-400">AI Listing Creator</span>
      </nav>

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f0f1a]">
          <div className="relative">
            <div className="w-full h-48 bg-gradient-to-br from-amber-900/40 to-amber-700/20 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto bg-amber-800/40 rounded-xl flex items-center justify-center mb-2">
                  <span className="text-4xl">👟</span>
                </div>
                <span className="text-xs text-gray-500">Product Photo</span>
              </div>
            </div>
            <div className="absolute top-3 right-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              AI Analyzed
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Title</label>
              <div className="mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-medium">
                Nike Air Max 270 Running Shoes - Men's Size 10 - Black/White
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
              <div className="mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm h-20 overflow-hidden">
                Excellent condition Nike Air Max 270 athletic running shoes. Features the iconic large Air unit heel for maximum cushioning and all-day comfort. Mesh upper provides breathability...
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Your Price (USD)</label>
                <div className="mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-bold">$89.99</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Quantity</label>
                <div className="mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">1</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f1a] rounded-2xl border border-white/10 p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">Select Marketplaces (14 available)</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              {name: "eBay", color: "text-yellow-400", checked: true},
              {name: "Amazon", color: "text-orange-400", checked: true},
              {name: "Etsy", color: "text-orange-300", checked: true},
              {name: "Shopify", color: "text-green-400", checked: false},
              {name: "Walmart", color: "text-blue-400", checked: true},
              {name: "OfferUp", color: "text-teal-400", checked: true},
              {name: "Mercado Libre", color: "text-yellow-300", checked: false},
              {name: "Reverb", color: "text-teal-400", checked: false},
            ].map(m => (
              <div key={m.name} className={`flex items-center gap-2 p-2 rounded-lg border ${m.checked ? "border-blue-500/40 bg-blue-500/10" : "border-white/10"}`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center ${m.checked ? "bg-blue-600" : "bg-white/10"}`}>
                  {m.checked && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                </div>
                <span className={`text-xs font-medium ${m.color}`}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base">
          Create Listings on 5 Marketplaces →
        </button>
      </div>
    </div>
  );
}

function ListingsSlide() {
  const products = [
    { title: "Nike Air Max 270 - Men's Size 10", price: "$89.99", markets: 5, status: "active", emoji: "👟", qty: 1 },
    { title: "Vintage Levi's 501 Jeans - W32 L30", price: "$65.00", markets: 4, status: "active", emoji: "👖", qty: 1 },
    { title: "Sony WH-1000XM4 Headphones", price: "$199.00", markets: 6, status: "active", emoji: "🎧", qty: 1 },
    { title: "Apple Watch Series 7 - 45mm Silver", price: "$349.00", markets: 3, status: "sold_out", emoji: "⌚", qty: 0 },
    { title: "Hydroflask 32oz Wide Mouth - Forest", price: "$28.00", markets: 5, status: "active", emoji: "🍶", qty: 2 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="border-b border-white/10 bg-[#0f0f1a] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-blue-500"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 14L2 8z"/></svg></div>
          <span className="font-bold text-white">Global Lister</span>
        </div>
        <span className="text-sm text-gray-400">My Listings</span>
      </nav>

      <div className="flex-1 px-4 py-5 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-bold text-xl">Active Listings</h2>
          <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-medium">+ New Listing</div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Active", value: "4", color: "text-green-400" },
            { label: "Marketplaces", value: "23", color: "text-blue-400" },
            { label: "Total Value", value: "$631", color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {products.map((p, i) => (
          <div key={i} className={`bg-[#0f0f1a] rounded-2xl border p-4 ${p.status === "sold_out" ? "border-white/5 opacity-60" : "border-white/10"}`}>
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 bg-white/5 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-white/10">
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm font-medium leading-tight line-clamp-2">{p.title}</p>
                  {p.status === "sold_out" && (
                    <div className="flex items-center gap-1 bg-gradient-to-r from-purple-900/60 to-purple-700/40 border border-purple-500/40 rounded-full px-2 py-0.5 shrink-0">
                      <img src="/kauf-logo.jpeg" alt="KAUF" className="w-3 h-3 rounded-sm object-cover" />
                      <span className="text-xs font-semibold text-purple-200">Sold with KAUF</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-blue-400 font-bold text-sm">{p.price}</span>
                  <span className="text-gray-500 text-xs">{p.markets} markets</span>
                  <span className="text-gray-600 text-xs">Qty: {p.qty}</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {["eBay","AMZ","Etsy","WM","OU"].slice(0, p.markets).map(m => (
                    <span key={m} className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesSlide() {
  const sales = [
    { product: "Nike Air Max 270", marketplace: "eBay", amount: "$89.99", fee: "$0.90", paid: true, date: "Apr 3" },
    { product: "Sony WH-1000XM4", marketplace: "Amazon", amount: "$199.00", fee: "$1.99", paid: false, date: "Apr 2" },
    { product: "Vintage Levi's 501", marketplace: "OfferUp", amount: "$65.00", fee: "$0.65", paid: true, date: "Apr 1" },
    { product: "Apple Watch Series 7", marketplace: "eBay", amount: "$349.00", fee: "$3.49", paid: false, date: "Mar 30" },
    { product: "Hydroflask 32oz", marketplace: "Etsy", amount: "$28.00", fee: "$0.28", paid: true, date: "Mar 28" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="border-b border-white/10 bg-[#0f0f1a] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-blue-500"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 14L2 8z"/></svg></div>
          <span className="font-bold text-white">Global Lister</span>
        </div>
        <span className="text-sm text-gray-400">Sales Tracker</span>
      </nav>

      <div className="flex-1 px-4 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <div className="text-2xl font-bold text-green-400">$730.99</div>
            <div className="text-green-600 text-xs mt-1">Total Sales</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <div className="text-2xl font-bold text-blue-400">$7.31</div>
            <div className="text-blue-600 text-xs mt-1">Total Fees (2%)</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Recent Sales</h3>
          <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full">+ Log Sale</div>
        </div>

        {sales.map((s, i) => (
          <div key={i} className="bg-[#0f0f1a] rounded-2xl border border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white text-sm font-medium">{s.product}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500 text-xs">{s.marketplace}</span>
                  <span className="text-gray-700 text-xs">·</span>
                  <span className="text-gray-500 text-xs">{s.date}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-sm">{s.amount}</div>
                <div className="text-gray-500 text-xs mt-0.5">Fee: {s.fee}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              {s.paid ? (
                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  Fee Paid
                </span>
              ) : (
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full cursor-pointer">
                  Pay Fee →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSlide() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="border-b border-white/10 bg-[#0f0f1a] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-blue-500"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 14L2 8z"/></svg></div>
          <span className="font-bold text-white">Global Lister</span>
        </div>
        <span className="text-sm text-gray-400">Dashboard</span>
      </nav>

      <div className="flex-1 px-4 py-5 space-y-4">
        <h2 className="text-white font-bold text-xl">Your Overview</h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Active Listings", value: "4", sub: "across 5 items", color: "from-blue-600/20 to-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
            { label: "Total Sales", value: "$730", sub: "5 transactions", color: "from-green-600/20 to-green-500/10", border: "border-green-500/20", text: "text-green-400" },
            { label: "Marketplaces", value: "14", sub: "available globally", color: "from-purple-600/20 to-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" },
            { label: "Trial Days Left", value: "28", sub: "then 2% per sale", color: "from-orange-600/20 to-orange-500/10", border: "border-orange-500/20", text: "text-orange-400" },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl border ${s.border} p-4`}>
              <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-white text-xs font-medium mt-1">{s.label}</div>
              <div className="text-gray-500 text-xs mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#0f0f1a] rounded-2xl border border-white/10 p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">Sales by Marketplace</h3>
          <div className="space-y-3">
            {[
              { name: "eBay", pct: 42, color: "bg-yellow-500", amount: "$307" },
              { name: "Amazon", pct: 27, color: "bg-orange-500", amount: "$198" },
              { name: "OfferUp", pct: 18, color: "bg-teal-500", amount: "$131" },
              { name: "Etsy", pct: 13, color: "bg-orange-300", amount: "$95" },
            ].map(m => (
              <div key={m.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{m.name}</span>
                  <span className="text-gray-400">{m.amount}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0f0f1a] rounded-2xl border border-white/10 p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">Global Reach</h3>
          <div className="grid grid-cols-4 gap-2">
            {["🇺🇸 USD","🇬🇧 GBP","🇪🇺 EUR","🇧🇷 BRL","🇯🇵 JPY","🇦🇺 AUD","🇨🇦 CAD","🇲🇽 MXN"].map(c => (
              <div key={c} className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
                <span className="text-xs text-gray-400">{c}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs text-center mt-3">Auto currency conversion for all markets</p>
        </div>
      </div>
    </div>
  );
}

export default function Screenshots() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const slide = params.get("slide") || "upload";

  const components: Record<string, ReactElement> = {
    upload: <UploadSlide />,
    analyze: <AnalyzeSlide />,
    listings: <ListingsSlide />,
    sales: <SalesSlide />,
    dashboard: <DashboardSlide />,
  };

  return components[slide] || <UploadSlide />;
}
