import React, { useEffect } from 'react';

const Welcome = () => {
  const triggerCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) console.log("Picture captured:", file.name);
    };
    input.click();
  };
  useEffect(() => {
    // This triggers the camera automatically when the page loads
    triggerCamera();
  }, []);
 
 return (
   <div className="min-h-screen flex items-center justify-center bg-white p-4">
     <section className="max-w-md w-full text-center">

     <h1 className="text-6xl uppercase mb-2 text-black" style={{ fontFamily: '"Bodoni 72", serif', fontWeight: '800' }}>
 Kauf-AI
</h1>
<p className="text-[14px] font-black tracking-[0.4em] uppercase mb-10 bg-gradient-to-r from-[#40C9FF] to-[#E81CFF] bg-clip-text text-transparent">
         Picture ▯ Post ▯ Sell
       </p>

       <div className="flex justify-center mb-12">
       <div className="relative w-full max-w-[320px] aspect-square border-2 border-dashed border-gray-200 flex flex-col items-center cursor-pointer" onClick={() => console.log("Camera sequence initiated via logo")}>
       <img
           src="/kauf26-logo.JPG"
         alt="Kauf26 Logo"
         className="w-full h-full object-contain cursor-pointer"
         onClick={triggerCamera}
       />
   <p className="mt-4 font-bold uppercase text-gray-700">Free 14 Day Trial</p>
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