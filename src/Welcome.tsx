import React from 'react';

const Welcome = () => {
 return (
   <div className="min-h-screen bg-white flex flex-col items-center">
     {/* Hero Section */}
     <section className="py-20 px-6 text-center">
       <h1 className="text-6xl font-bold text-gray-900 mb-6">Kauf26</h1>

       <p className="text-2xl text-gray-700 mb-4">
         Snap a picture. Select your marketplaces. Sell your product.
       </p>

       <div className="inline-block bg-blue-50 border border-blue-200 text-blue-700 font-bold px-4 py-1 rounded-full mb-8">
         Free 14-Day Trial
       </div>

       <div className="flex justify-center mb-12">
         {/* Your main product/demo photo goes here */}
         <img
           src="/welcome-photo.png"
           alt="Product Demo"
           className="rounded-2xl shadow-xl max-w-full h-auto border"
         />
       </div>

       <button className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 px-12 rounded-full transition-transform hover:scale-105">
         Get Started
       </button>

       <p className="mt-6 text-gray-500 italic text-sm">
         *30-day escrow hold policy applies to all sales for protection.
       </p>
     </section>
   </div>
 );
};

export default Welcome;