import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ProductCamera from "./components/ProductCamera";
import { useProductDraft } from "./ProductDraftContext";
import {
  initializeWelcomePage,
  WELCOME_RESET_EVENT,
} from "@/lib/resetListingFlow";

const Welcome = () => {
  const [, setLocation] = useLocation();
  const { clearDraft } = useProductDraft();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  useEffect(() => {
    clearDraft();
    setShowCamera(false);
    setCameraKey((key) => key + 1);
    initializeWelcomePage();

    const remountCamera = () => {
      setShowCamera(false);
      setCameraKey((key) => key + 1);
    };

    window.addEventListener(WELCOME_RESET_EVENT, remountCamera);
    return () => window.removeEventListener(WELCOME_RESET_EVENT, remountCamera);
  }, [clearDraft]);

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
        <p className="text-sm text-gray-600 mt-3 max-w-md mx-auto leading-relaxed">
          For best results, take up to 5 photos: front, back, label/tag, and details.
        </p>
      </section>

      {/* Main Interaction Area - Logo triggers camera */}
      <div className="w-full max-w-md px-4 flex flex-col items-center justify-center flex-1 min-h-0">
        {showCamera ? (
          <div
            className="w-full min-h-[min(72vh,640px)] flex flex-col rounded-3xl overflow-hidden border-4 border-gray-100 shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <ProductCamera
              key={cameraKey}
              onScrapeSuccess={() => {
                setLocation("/identification-results");
              }}
            />
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
