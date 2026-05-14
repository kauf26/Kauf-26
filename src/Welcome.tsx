import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";

const Welcome = () => {
 const fileInputRef = useRef<HTMLInputElement>(null);
 const navigate = useNavigate();

 const triggerCamera = () => {
   fileInputRef.current?.click();
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0];
   if (file) {
     console.log("File selected:", file);

     // 1. This is where your 'Scraper' logic starts.
     // For now, we simulate the scraped data results:
     const scrapedData = {
       title: "Exact Match Product Title", // Replace with real scraper output
       description: "Exact Match Product Description",
       price: "0.00",
       condition: "New", // Default value for user to change
       category: "Electronics",
       imageUrl: URL.createObjectURL(file) // Passes the preview to page 2
     };

     // 2. Push the data to Page 2 (IdentificationResults)
     navigate("/identification-results", { state: { productData: scrapedData } });
   }
 };

 return (
   <div className="min-h-screen flex items-center justify-center bg-white font-sans">
     <section className="max-w-md w-full text-center px-4">
       <h1 className="text-7xl mb-2 text-black leading-none font-serif font-bold tracking-tighter">
         KAUF-AI
       </h1>

       <p className="text-[14px] font-black tracking-widest uppercase mb-8 bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
         Picture □ Post □ Sell
       </p>

       <div className="flex justify-center mb-12 w-full">
         <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden border-4 border-gray-100 shadow-2xl">
           <img
             src="/IMG_2482.JPG"
             alt="Kauf-AI Preview"
             className="w-full h-auto object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
             onClick={triggerCamera}
           />
         </div>
       </div>

       <input
         type="file"
         ref={fileInputRef}
         style={{ display: "none" }}
         accept="image/*"
         onChange={handleFileChange}
       />

       <p className="mt-4 font-bold uppercase text-gray-700 text-center tracking-widest">
         14 DAY FREE TRIAL
       </p>
     </section>
   </div>
 );
};

export default Welcome;