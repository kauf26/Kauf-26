import React, { useRef } from "react";

const Welcome = () => {
 const fileInputRef = useRef<HTMLInputElement>(null);

 const triggerCamera = () => {
   fileInputRef.current?.click();
 };

 return (

    <div className="min-h-screen flex items-center justify-center bg-white font-sans">
      <section className="max-w-md w-full text-center px-4">
      <h1 className="text-7xl mb-2 text-black leading-none font-serif font-bold tracking-tight">
 KAUF-AI
</h1>

        <p className="text-[14px] font-black tracking-widest uppercase mb-8 bg-gradient-to-r from-blue-400 to-pink-500 bg-clip-text text-transparent">
          Picture ▢ Post ▢ Sell
        </p>

        <div className="flex justify-center mb-12 w-full">
        <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden flex justify-center items-center">
        <img
 src="/IMG_2482.JPG"
 alt="Kauf-AI Preview"
 className="w-full h-auto object-cover cursor-pointer"
 onClick={triggerCamera}
/>
<input
 type="file"
 ref={fileInputRef}
 style={{ display: 'none' }}
 accept="image/*"
 onChange={(e) => console.log("File selected:", e.target.files?.[0])}
/>

          </div>
        </div>

        <p className="mt-4 font-bold uppercase text-gray-700 text-center tracking-wide">
          14 DAY FREE TRIAL
        </p>
      </section>
    </div>
  );
};

export default Welcome;
