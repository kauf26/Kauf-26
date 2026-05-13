import React, { useState } from 'react';

const ProductDraft: React.FC = () => {
 const [product] = useState({
   isExactMatch: true,
   title: "Draft Product Title",
   brand: "Brand Name",
   description: "Detailed product description goes here...",
   price: "0.00",
   category: "General"
 });
 const PROHIBITED_KEYWORDS = ["gun", "drugs", "alcohol", "tobacco", "vape", "weapon"];

 const isProhibited = PROHIBITED_KEYWORDS.some(keyword =>
   product.title.toLowerCase().includes(keyword) ||
   product.category.toLowerCase().includes(keyword)
 );



 return (
   <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
     <header className="border-b pb-4 mb-6">
       <h1 className="text-2xl font-bold text-gray-800">
         {product.isExactMatch ? '✅ Exact Match Found' : '📝 Basic Product Draft'}
       </h1>
       <p className="text-sm text-gray-500 italic">
         Review your {product.brand} listing before posting.
       </p>
     </header>

     <form className="space-y-4">
       <div>
         <label className="block text-sm font-medium text-gray-700">Product Title</label>
         <input
           type="text"
           defaultValue={product.title}
           className="w-full p-2 border rounded-md"
         />
       </div>

       <div>
         <label className="block text-sm font-medium text-gray-700">Description</label>
         <textarea
           rows={6}
           defaultValue={product.description}
           className="w-full p-2 border rounded-md"
         />
       </div>

       <div className="flex gap-4">
         <div className="flex-1">
           <label className="block text-sm font-medium text-gray-700">Suggested Price</label>
           <input
             type="text"
             defaultValue={product.price}
             className="w-full p-2 border rounded-md"
           />
         </div>
         <div className="flex-1">
           <label className="block text-sm font-medium text-gray-700">Category</label>
           <input
             type="text"
             defaultValue={product.category}
             className="w-full p-2 border rounded-md"
           />
       </div>
     </div>
   </form>
     {/* --- THE STOP POINT ALERT & NAVIGATION --- */}
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
   </div>
 );
};

export default ProductDraft;