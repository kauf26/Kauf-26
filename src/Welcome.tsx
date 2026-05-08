import React from 'react';

const Welcome = () => {
 return (
   <div className="min-h-screen flex items-center justify-center bg-white p-4">
     <section className="max-w-md w-full text-center">
       <h1 className="text-6xl font-bold text-gray-900 mb-2 tracking-tight">
         Kauf26
       </h1>
       <p className="text-xl font-medium text-gray-500 mb-10 tracking-wide">
         Picture ▯ Post ▯ Sell
       </p>

       <div className="flex justify-center mb-12">
         <div className="relative w-full max-w-[320px] aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50">
           <img
             src="/kauf-logo.jpeg"
             className="w-full h-full object-cover"
             
           />
         </div>
       </div>

       <div className="px-4 text-center">
         <button onClick={() => console.log("Camera sequence initiated")}>
           Get Started
         </button>
         <p>*Secure Escrow Protection Enabled</p>
       </div>
     </section>
   </div>
 );
};
export default Welcome;