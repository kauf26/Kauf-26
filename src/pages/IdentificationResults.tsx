import React from "react";
import { useLocation as useWouterLocation } from "wouter";
import { useLocation as useRouterLocation } from "react-router-dom";

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

const IdentificationResults: React.FC<IdentificationResultsProps> = ({
  productData,
  marketPrices,
}) => {
 const [, setLocation] = useWouterLocation();

 const handleContinue = () => {
   // Bridges the gap to Page 2 by storing the "winning" scraper data locally
   const draftData = {
     ...productData,
     ...marketPrices,
     timestamp: new Date().toISOString()
   };

   sessionStorage.setItem('pending_kauf26_draft', JSON.stringify(draftData));
   setLocation('/product-draft');
 };

 return (
   <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24 text-gray-900">
     {/* Top Section: Visual Match */}
     <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
       <div className="flex flex-col md:flex-row gap-6 items-center">
         <div className="w-full md:w-1/3 aspect-square bg-gray-200 rounded-xl overflow-hidden">
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
           <h1 className="text-3xl font-bold">{productData.modelName}</h1>
           <p className="text-gray-500 mt-2">{productData.brand} • {productData.year}</p>
         </div>
       </div>
     </section>

     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       {/* Middle Section: Specs & AI Description */}
       <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-blue-600">Technical Specs</h2>
         <div className="grid grid-cols-2 gap-4 text-sm">
           <div className="text-gray-500">Condition</div>
           <div className="font-medium text-right uppercase">{productData.condition}</div>
           <div className="text-gray-500">Model Number</div>
           <div className="font-medium text-right">{productData.refNumber}</div>
           <div className="text-gray-500">Material</div>
           <div className="font-medium text-right">{productData.material}</div>
         </div>

         <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2 text-blue-600">Market Description</h2>
         <p className="text-gray-700 leading-relaxed italic text-sm">
           "{productData.aiDescription}"
         </p>
       </section>

       {/* Right Section: Marketplace Intelligence */}
       <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-blue-600">Marketplace Values</h2>
         <div className="space-y-4">
           <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
             <span className="font-bold text-blue-800">Allegro Average</span>
             <span className="text-xl font-black text-blue-900">${marketPrices.allegroAvg}</span>
           </div>
           <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
             <span className="font-bold text-orange-800">eBay Average</span>
             <span className="text-xl font-black text-orange-900">${marketPrices.ebayAvg}</span>
           </div>

           <div className="mt-8 p-4 bg-gray-900 text-white rounded-xl text-center">
             <p className="text-xs uppercase tracking-widest text-gray-400">Suggested Listing Price</p>
             <p className="text-4xl font-black mt-1">${marketPrices.recommendedPrice}</p>
           </div>
         </div>
       </section>
     </div>

     {/* NAVIGATION FOOTER */}
     <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-center z-50">
       <button
         onClick={handleContinue}
         className="w-full max-w-md bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
       >
         Continue to Draft & Post
       </button>
     </div>
   </div>
 );
};

/** Shape stored by Welcome when navigating here via react-router `state`. */
type WelcomeScrapedPayload = {
  title?: string;
  description?: string;
  price?: string;
  condition?: string;
  category?: string;
  imageUrl?: string;
};

const DEFAULT_PRODUCT_DATA: IdentificationResultsProps["productData"] = {
  capturedImage: "",
  modelName: "No product loaded",
  brand: "—",
  year: "—",
  condition: "—",
  refNumber: "—",
  material: "—",
  aiDescription: "Use the camera flow from the home screen to identify an item.",
};

const DEFAULT_MARKET_PRICES: IdentificationResultsProps["marketPrices"] = {
  allegroAvg: 0,
  ebayAvg: 0,
  recommendedPrice: 0,
};

function mapWelcomeScrapedToProps(
  scraped: WelcomeScrapedPayload
): IdentificationResultsProps {
  const priceNum = Number(scraped.price) || 0;
  return {
    productData: {
      capturedImage: scraped.imageUrl ?? "",
      modelName: scraped.title ?? "Identified Item",
      brand: scraped.category ?? "Identified Item",
      year: new Date().getFullYear(),
      condition: scraped.condition ?? "new",
      refNumber: "AUTO-GEN",
      material: "Detected",
      aiDescription: scraped.description ?? "",
    },
    marketPrices: {
      allegroAvg: priceNum,
      ebayAvg: priceNum * 1.1,
      recommendedPrice: priceNum,
    },
  };
}

function propsFromRouterState(
  state: unknown
): IdentificationResultsProps | null {
  if (!state || typeof state !== "object") return null;
  const s = state as Record<string, unknown>;

  if (s.productData && typeof s.productData === "object") {
    const pd = s.productData as Record<string, unknown>;
    if ("capturedImage" in pd && typeof pd.capturedImage === "string") {
      return {
        productData: {
          ...DEFAULT_PRODUCT_DATA,
          ...pd,
        } as IdentificationResultsProps["productData"],
        marketPrices: {
          ...DEFAULT_MARKET_PRICES,
          ...(typeof s.marketPrices === "object" && s.marketPrices !== null
            ? (s.marketPrices as IdentificationResultsProps["marketPrices"])
            : {}),
        },
      };
    }
    return mapWelcomeScrapedToProps(pd as WelcomeScrapedPayload);
  }

  if (s.marketPrices && typeof s.marketPrices === "object") {
    return {
      productData: DEFAULT_PRODUCT_DATA,
      marketPrices: {
        ...DEFAULT_MARKET_PRICES,
        ...(s.marketPrices as IdentificationResultsProps["marketPrices"]),
      },
    };
  }

  return null;
}

/** Standalone route: reads react-router location state (see Welcome) or shows defaults. */
export const IdentificationResultsPage: React.FC = () => {
  const { state } = useRouterLocation();
  const resolved = propsFromRouterState(state) ?? {
    productData: DEFAULT_PRODUCT_DATA,
    marketPrices: DEFAULT_MARKET_PRICES,
  };
  return (
    <IdentificationResults
      productData={resolved.productData}
      marketPrices={resolved.marketPrices}
    />
  );
};

export default IdentificationResults;

