import React, { useState, useEffect } from "react";
import { useLocation } from "wouter"; // use wouter, not window.location.hash
import { useToast } from "@/hooks/use-toast";

type ProductDraftState = {
 isExactMatch: boolean;
 title: string;
 brand: string;
 description: string;
 price: string;
 category: string;
 condition: string;
};

const DEFAULT_PRODUCT: ProductDraftState = {
 isExactMatch: true,
 title: "Draft Product Title",
 brand: "Brand Name",
 description: "Detailed product description goes here...",
 price: "0.00",
 category: "General",
 condition: "New",
};

const PROHIBITED_KEYWORDS = ["gun", "drugs", "alcohol", "tobacco", "vape", "weapon"];

const ProductDraft: React.FC = () => {
 const [, setLocation] = useLocation();
 const { toast } = useToast();
 const [product, setProduct] = useState<ProductDraftState>(DEFAULT_PRODUCT);

 // Load data from sessionStorage using the same key as IdentificationResults
 useEffect(() => {
   const saved = sessionStorage.getItem("pendingAnalysis");
   if (!saved) return;
   try {
     const data = JSON.parse(saved);
     // Build description fallback
     let finalDescription = data.aiDescription || data.description;
     if (!finalDescription) {
       const titlePart = data.modelName || data.title || "this product";
       const brandPart = data.brand ? `${data.brand} ` : "";
       const categoryPart = data.category || "item";
       const conditionPart = data.condition || "good";
       finalDescription = `${brandPart}${titlePart} – A high‑quality ${categoryPart} in ${conditionPart} condition.`;
     }
     // Price fallback
     let finalPrice = data.recommendedPrice?.toString() || data.price;
     if (!finalPrice) {
       const cat = (data.category || "General").toLowerCase();
       let min = 20, max = 500;
       if (cat.includes("electronics")) { min = 50; max = 1500; }
       else if (cat.includes("clothing")) { min = 15; max = 200; }
       else if (cat.includes("home")) { min = 10; max = 300; }
       finalPrice = (Math.random() * (max - min) + min).toFixed(2);
     }
     setProduct({
       isExactMatch: true,
       title: data.modelName || data.title || DEFAULT_PRODUCT.title,
       brand: data.brand || DEFAULT_PRODUCT.brand,
       description: finalDescription,
       price: finalPrice,
       category: data.category || DEFAULT_PRODUCT.category,
       condition: data.condition || DEFAULT_PRODUCT.condition,
     });
   } catch (e) {
     console.error("Error parsing product draft data:", e);
   }
 }, []);

 const isProhibited = PROHIBITED_KEYWORDS.some(kw =>
   product.title.toLowerCase().includes(kw) || product.category.toLowerCase().includes(kw)
 );

 const handleContinue = async () => {
   // Prepare the final product data for the create page
   const finalData = {
     capturedImage: "", // will be filled from previous step if needed
     modelName: product.title,
     brand: product.brand,
     year: new Date().getFullYear(),
     condition: product.condition.toLowerCase(),
     refNumber: "AUTO-GEN",
     material: "Detected",
     aiDescription: product.description,
     allegroAvg: parseFloat(product.price) || 0,
     ebayAvg: (parseFloat(product.price) * 1.1) || 0,
     recommendedPrice: parseFloat(product.price) || 0,
   };

   // Save to sessionStorage with the same key expected by create.tsx
   sessionStorage.setItem("pendingAnalysis", JSON.stringify(finalData));

   // Optional: send to backend draft endpoint (non-blocking)
   try {
     await fetch("/api/drafts", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         title: product.title,
         status: "draft",
         attributes: {
           brand: product.brand,
           description: product.description,
           price: product.price,
           category: product.category,
           condition: product.condition,
           isExactMatch: product.isExactMatch,
         },
       }),
     });
   } catch (err) {
     console.error("Draft sync failed (non-critical):", err);
   }

   // Navigate to the final publish page (create.tsx) using wouter
   setLocation("/create");
 };

 const update = (field: keyof ProductDraftState, val: string) => {
   setProduct(p => ({ ...p, [field]: val }));
 };

 return (
   <div className="max-w-2xl mx-auto p-4">
     <h1 className="text-2xl font-bold mb-4">Product Draft</h1>
     <div className="space-y-3">
       <div>
         <label className="font-semibold">Exact Match Title</label>
         <input className="border p-2 w-full" value={product.title} onChange={e => update("title", e.target.value)} />
       </div>
       <div>
         <label>Brand</label>
         <input className="border p-2 w-full" value={product.brand} onChange={e => update("brand", e.target.value)} />
       </div>
       <div>
         <label>Description</label>
         <textarea className="border p-2 w-full min-h-[100px]" value={product.description} onChange={e => update("description", e.target.value)} />
       </div>
       <div className="grid grid-cols-3 gap-2">
         <div><label>Price ($)</label><input className="border p-2 w-full" value={product.price} onChange={e => update("price", e.target.value)} /></div>
         <div><label>Category</label><input className="border p-2 w-full" value={product.category} onChange={e => update("category", e.target.value)} /></div>
         <div><label>Condition</label><input className="border p-2 w-full" value={product.condition} onChange={e => update("condition", e.target.value)} /></div>
       </div>
     </div>
     {isProhibited ? (
       <div className="mt-4 p-4 bg-red-600 text-white text-center">PROHIBITED ITEM</div>
     ) : (
       <button className="mt-4 w-full bg-blue-600 text-white p-3 rounded" onClick={handleContinue}>
         Continue to Marketplaces & Post
       </button>
     )}
   </div>
 );
};

export default ProductDraft;