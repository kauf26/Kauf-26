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
 </div>
 );
};

export default ProductDraft;


      