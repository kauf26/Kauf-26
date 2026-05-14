import React from 'react';

interface IdentificationResultsProps {
 productData: {
   capturedImage: string;
   modelName: string;
   brand: string;
   year: string | number;
   condition: string;
   refNumber: string;
   material: string;
   aiDescription: string;
 };
 marketPrices: {
   allegroAvg: number | string;
   ebayAvg: number | string;
   recommendedPrice: number | string;
 };
}

const IdentificationResults: React.FC<IdentificationResultsProps> = ({ productData, marketPrices }) => {
 return (
   <div className="min-h-screen bg-gray-50 p-4 md:p-8">
     {/* Top Section: Visual Match */}
     <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
       <div className="flex flex-col md:flex-row gap-6 items-center">
         <div className="w-full md:w-1/3 aspect-square bg-gray-200 rounded-xl overflow-hidden">
            {/* The frame captured from your "Ignite" camera step */}
           <img
             src={productData.capturedImage}
             alt="Captured Product"
             className="w-full h-full object-cover"
           />
         </div>
         <div className="flex-1 text-center md:text-left">
           <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-2">
             98% AI MATCH
           </span>
           <h1 className="text-3xl font-bold text-gray-900">{productData.modelName}</h1>
           <p className="text-gray-500 mt-2">{productData.brand} • {productData.year}</p>
         </div>
       </div>
     </section>

     {/* Middle Section: Specs & AI Description */}
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <h2 className="text-xl font-semibold mb-4 border-b pb-2">Technical Specs</h2>
         <div className="grid grid-cols-2 gap-4 text-sm">
           <div className="text-gray-500">Condition</div>
           <div className="font-medium text-right text-gray-900 uppercase">{productData.condition}</div>
           <div className="text-gray-500">Model Number</div>
           <div className="font-medium text-right text-gray-900">{productData.refNumber}</div>
           <div className="text-gray-500">Case Material</div>
           <div className="font-medium text-right text-gray-900">{productData.material}</div>
         </div>

         <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2">AI Generated Description</h2>
         <p className="text-gray-700 leading-relaxed italic">
           "{productData.aiDescription}"
         </p>
       </section>

       {/* Right Section: Marketplace Intelligence (Oxylabs/RapidAPI) */}
       <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <h2 className="text-xl font-semibold mb-4 border-b pb-2">Marketplace Intelligence</h2>
         <div className="space-y-4">
           {/* Scraped Pricing from Allegro/eBay */}
           <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
             <span className="font-bold text-blue-800">Allegro Average</span>
             <span className="text-xl font-black text-blue-900">${marketPrices.allegroAvg}</span>
           </div>
           <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
             <span className="font-bold text-orange-800">eBay Average</span>
             <span className="text-xl font-black text-orange-900">${marketPrices.ebayAvg}</span>
           </div>
         </div>

         <div className="mt-8 p-4 bg-gray-900 text-white rounded-xl text-center">
           <p className="text-xs uppercase tracking-widest text-gray-400">Suggested Listing Price</p>
           <p className="text-4xl font-black mt-1">${marketPrices.recommendedPrice}</p>
         </div>
       </section>
     </div>

     {/* Global Shipping/Tax Preview Placeholder */}
     <section className="mt-8 p-6 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 text-center">
       <p className="text-gray-500 font-medium">Estimated Global Taxes & Shipping (Calculating for 17 Markets...)</p>
     </section>
   </div>
 );
};

export default IdentificationResults;