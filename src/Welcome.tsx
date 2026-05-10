import React, { useEffect } from 'react';

const Welcome = () => {
  const triggerCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        console.log("Captured for Kauf-AI:", file.name);
     
        // 1. Create a preview (Optional, for your UI)
        const reader = new FileReader();
        reader.onload = () => {
          // You can set this to a state variable to show the user what they just took
          // setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
     
        // 2. Prepare to send to your Local Server
        const formData = new FormData();
        formData.append('image', file);
     
        try {
          // This calls your local backend (we'll set this up next)
          const response = await fetch('http://localhost:5001/api/identify', {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          console.log("Identification Results:", data.description);
          // Redirect or update UI with the description
        } catch (err) {
          console.error("Capture Error:", err);
        }
      }
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