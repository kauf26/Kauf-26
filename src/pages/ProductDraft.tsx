import React, { useState, useEffect } from "react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

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

function getInitialProduct(): ProductDraftState {
  try {
    const raw = sessionStorage.getItem("pending_kauf26_draft");
    if (!raw) return DEFAULT_PRODUCT;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return DEFAULT_PRODUCT;

    const title =
      typeof data.modelName === "string"
        ? data.modelName
        : typeof data.title === "string"
          ? data.title
          : DEFAULT_PRODUCT.title;
    const description =
      typeof data.aiDescription === "string"
        ? data.aiDescription
        : typeof data.description === "string"
          ? data.description
          : DEFAULT_PRODUCT.description;
    const price =
      data.recommendedPrice != null && data.recommendedPrice !== ""
        ? String(data.recommendedPrice)
        : typeof data.price === "string"
          ? data.price
          : DEFAULT_PRODUCT.price;

    const category =
      typeof data.category === "string"
        ? data.category
        : DEFAULT_PRODUCT.category;
    const condition =
      typeof data.condition === "string"
        ? data.condition
        : DEFAULT_PRODUCT.condition;

    return {
      isExactMatch:
        typeof data.isExactMatch === "boolean"
          ? data.isExactMatch
          : DEFAULT_PRODUCT.isExactMatch,
      title,
      brand:
        typeof data.brand === "string" ? data.brand : DEFAULT_PRODUCT.brand,
      description,
      price,
      category,
      condition,
    };
  } catch {
    return DEFAULT_PRODUCT;
  }
}

const ProductDraft: React.FC = () => {
 const [product, setProduct] = useState<ProductDraftState>(() =>
   getInitialProduct()
 );

 useEffect(() => {
  const saved = sessionStorage.getItem("pending_kauf26_draft");
  if (!saved) return;
  try {
    const data = JSON.parse(saved) as {
      title?: string;
      modelName?: string;
      brand?: string;
      description?: string;
      aiDescription?: string;
      recommendedPrice?: string | number;
      price?: string;
      category?: string;
      condition?: string;
    };
    if (!data || typeof data !== "object") return;

    setProduct({
      isExactMatch: true,
      title: data.title || data.modelName || "",
      brand: data.brand || "",
      description: data.description || data.aiDescription || "",
      price: data.price || (data.recommendedPrice ? `${data.recommendedPrice}` : "0.00"),
      category: data.category || "General",
      condition: typeof data.condition === "string" ? data.condition : "New",
    });
  } catch {
    /* invalid JSON - keep initial state from useState */
  }
}, []);

 const PROHIBITED_KEYWORDS = [
   "gun", "drugs", "alcohol", "tobacco", "vape", "weapon",
 ];

 const isProhibited = PROHIBITED_KEYWORDS.some(
   (keyword) =>
     product.title.toLowerCase().includes(keyword) ||
     product.category.toLowerCase().includes(keyword) ||
     product.condition.toLowerCase().includes(keyword)
 );

 return (
   <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
     <header className="border-b pb-4 mb-6">
       <h1 className="text-2xl font-bold text-gray-800">
         {product.isExactMatch ? "✅ Exact Match Found" : "📝 Basic Product Draft"}
       </h1>
       <p className="text-sm text-gray-500 italic">
         Review your {product.brand} listing before posting.
       </p>
     </header>

     <form className="space-y-4">
       <div className="space-y-2">
         <Label htmlFor="product-title" className="text-gray-700">Product Title</Label>
         <Input
           id="product-title"
           type="text"
           value={product.title}
           onChange={(e) => setProduct({ ...product, title: e.target.value })}
           className="w-full"
         />
       </div>

       <div className="space-y-2">
         <Label htmlFor="product-description" className="text-gray-700">Description</Label>
         <Textarea
           id="product-description"
           rows={6}
           value={product.description}
           onChange={(e) => setProduct({ ...product, description: e.target.value })}
           className="w-full min-h-[120px]"
         />
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="space-y-2">
           <Label htmlFor="product-price" className="text-gray-700">Suggested Price</Label>
           <Input
             id="product-price"
             type="text"
             value={product.price}
             onChange={(e) => setProduct({ ...product, price: e.target.value })}
             className="w-full"
           />
         </div>
         <div className="space-y-2">
           <Label htmlFor="product-category" className="text-gray-700">Category</Label>
           <Input
             id="product-category"
             type="text"
             value={product.category}
             onChange={(e) => setProduct({ ...product, category: e.target.value })}
             className="w-full"
           />
         </div>
         <div className="space-y-2">
           <Label htmlFor="product-condition" className="text-gray-700 font-medium">Condition</Label>
           <Input
             id="product-condition"
             type="text"

           />
         </div>
       </div>

       {isProhibited ? (
         <div className="mt-6 p-6 bg-red-600 border-2 border-white rounded-xl shadow-lg text-white">
           <h3 className="text-xl font-bold flex items-center gap-2">
             <span>⛔</span> PROHIBITED ITEM ALERT
           </h3>
           <p className="mt-2 font-medium">
             This item is flagged as prohibited for sale in international markets.
             You cannot proceed with this listing.
           </p>
         </div>
       ) : (
         <button
           type="button"
           onClick={() => {
             window.location.hash = "/marketplaces";
           }}
           className="mt-6 w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
         >
           Continue
         </button>
       )}
     </form>
   </div>
 );
};

export default ProductDraft;