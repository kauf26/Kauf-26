import React, { useState } from "react";
import ProductCamera from "./components/ProductCamera";

const Welcome = () => {
 const [showCamera, setShowCamera] = useState(false);

 return (
   <div className="min-h-screen flex flex-col items-center justify-between bg-white font-sans py-8">
     {/* Header - KAUF-AI on one line, smaller font */}
     <section className="w-full text-center px-4">
       <h1 className="text-6xl mb-1 text-black font-serif font-bold tracking-tighter">
         KAUF-AI
       </h1>
       {/* Gradient text: Blue, Purple, Pink */}
       <p className="text-[16px] font-black tracking-widest uppercase bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
         PICTURE □ POST □ SELL
       </p>
     </section>

     {/* Main Interaction Area - Logo triggers camera */}
     <div className="w-full max-w-[320px] aspect-square flex items-center justify-center">
       {showCamera ? (
         <div className="w-full h-full rounded-3xl overflow-hidden border-4 border-gray-100 shadow-2xl">
           {/* The component below should now initiate the camera feed immediately */}
           <ProductCamera />
         </div>
       ) : (
         <img
           src="/IMG_2482.JPG"
           alt="Kauf-AI Logo"
           className="w-full h-auto cursor-pointer hover:scale-105 transition-transform duration-300"
           onClick={() => setShowCamera(true)}
         />
       )}
     </div>


     {/* Footer */}
     <p className="font-bold uppercase text-gray-700 text-center tracking-widest">
       14 DAY FREE TRIAL
     </p>
   </div>
 );
};

export default Welcome;
