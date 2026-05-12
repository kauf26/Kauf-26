import React from "react";

const Welcome = () => {
  const triggerCamera = () => {
    console.log("Camera triggered");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-sans">
      <section className="max-w-md w-full text-center px-4">
        <h1 className="text-7xl mb-2 text-black leading-none font-serif font-black tracking-tight flex items-center justify-center">
          KAUF <span className="font-sans px-2 text-5xl font-bold align-middle">–</span> A
        </h1>

        <p className="text-[14px] font-black tracking-widest uppercase mb-8 bg-gradient-to-r from-blue-400 to-pink-500 bg-clip-text text-transparent">
          Picture ▢ Post ▢ Sell
        </p>

        <div className="flex justify-center mb-12">
          <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden shadow-sm">
            <img
              src="/kauf-camera.png"
              alt="KAUF camera logo"
              className="w-full h-full object-cover cursor-pointer"
              onClick={triggerCamera}
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
