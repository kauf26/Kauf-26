import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button" // (or whatever your button path is)
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { loadListingSession } from "@/lib/pendingAnalysis";
import { resetListingFlow } from "@/lib/resetListingFlow";
import { useProductDraft } from "@/ProductDraftContext";

interface ProductDraft {
 capturedImage: string;
 modelName: string;
 brand: string;
 year: number;
 condition: string;
 category: string;
 refNumber: string;
 material: string;
 aiDescription: string;
 recommendedPrice: number;
 allegroAvg: number;
 ebayAvg: number;
};

export default function Create() {
 const [, navigate] = useLocation();
 const { clearDraft } = useProductDraft();
 const [draft, setDraft] = useState<ProductDraft | null>(null);
 const [isEditing, setIsEditing] = useState(false);

 useEffect(() => {
   const listing = loadListingSession();
   if (listing) {
     setDraft({
       capturedImage: listing.capturedImage,
       modelName: listing.title,
       brand: listing.brand,
       year: new Date().getFullYear(),
       condition: listing.condition,
       category: listing.category,
       refNumber: "",
       material: "",
       aiDescription: listing.description,
       recommendedPrice: parseFloat(listing.price) || 0,
       allegroAvg: parseFloat(listing.product.allegroAvg) || 0,
       ebayAvg: parseFloat(listing.product.ebayAvg) || 0,
     });
     return;
   }
   const stored = sessionStorage.getItem("pendingAnalysis");
   if (stored) {
     try {
       const parsed = JSON.parse(stored) as ProductDraft;
       setDraft(parsed);
     } catch (error) {
       console.error("Failed to parse product draft", error);
     }
   }
 }, []);

 const handleStartOver = () => {
   resetListingFlow({ clearDraftContext: clearDraft });
   navigate("/");
 };

 const handleConfirmAndContinue = () => {
   if (!draft) return;
   const selectionPayload = {
     capturedImage: draft.capturedImage,
     title: draft.modelName,
     description: draft.aiDescription,
     price: draft.recommendedPrice.toString(),
     brand: draft.brand,
     condition: draft.condition,
     category: draft.category,
   };
   sessionStorage.setItem("pendingAnalysis", JSON.stringify(selectionPayload));
   navigate("/select-marketplaces");
 };

 if (!draft) {
   return (
     <div className="p-8 text-center text-zinc-500 bg-zinc-950 min-h-screen">
       Loading product data…
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
     <div className="w-full max-w-2xl mx-auto py-6">
     <Button
       variant="ghost"
       onClick={handleStartOver}
       className="mb-4 text-zinc-400 hover:text-white hover:bg-zinc-800"
>
 <ArrowLeft className="w-4 h-4 mr-2" />
 Start over
</Button>

       <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
         <CardHeader className="border-b border-zinc-800 pb-4">
           <CardTitle className="text-xl font-bold tracking-tight text-zinc-200">
             Your Product Node
           </CardTitle>
           <CardDescription className="text-xs text-zinc-500">
             Review and verify absolute parameters before final syndication.
           </CardDescription>
         </CardHeader>

         <CardContent className="space-y-5 pt-5">
           <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-2 flex items-center justify-center min-h-[240px]">
             {draft.capturedImage ? (
               <img
                 src={draft.capturedImage}
                 alt="Product preview"
                 className="max-h-64 rounded object-cover w-full"
               />
             ) : (
               <span className="text-xs text-zinc-600">Product Image Stream Unavailable</span>
             )}
           </div>

           <div className="space-y-3">
             <div className="space-y-1">
               <label className="text-xs font-medium text-zinc-500">Model / Title</label>
               <input
                 type="text"
                 value={draft.modelName || ""}
                 onChange={(e) => setDraft({ ...draft, modelName: e.target.value })}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none disabled:opacity-50"
                 disabled={!isEditing}
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-medium text-zinc-500">Brand</label>
                 <input
                   type="text"
                   value={draft.brand || ""}
                   onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none disabled:opacity-50"
                   disabled={!isEditing}
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-medium text-zinc-500">Listing Price ($)</label>
                 <input
                   type="text"
                   value={draft.recommendedPrice || ""}
                   onChange={(e) =>
                     setDraft({ ...draft, recommendedPrice: parseFloat(e.target.value) || 0 })
                   }
                   className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none disabled:opacity-50"
                   disabled={!isEditing}
                 />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-medium text-zinc-500">Condition</label>
                 <input
                   type="text"
                   value={draft.condition || ""}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-400 capitalize disabled:opacity-100"
                   disabled
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-medium text-zinc-500">Material Composition</label>
                 <input
                   type="text"
                   value={draft.material || ""}
                   onChange={(e) => setDraft({ ...draft, material: e.target.value })}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none disabled:opacity-50"
                   disabled={!isEditing}
                 />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-medium text-zinc-500">AI Generated Description</label>
               <textarea
                 rows={4}
                 value={draft.aiDescription || ""}
                 onChange={(e) => setDraft({ ...draft, aiDescription: e.target.value })}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none resize-none disabled:opacity-50"
                 disabled={!isEditing}
               />
             </div>
           </div>

           <div className="flex gap-3 justify-end pt-2">
             <Button
               variant="outline"
               type="button"
               onClick={() => setIsEditing(!isEditing)}
               className="border-zinc-800 bg-zinc-950 text-zinc-300..." >  {/* <--- Add > here */}

               {isEditing ? "Cancel Parameters" : "Edit Details"}
             </Button>
             <Button
               type="button"
               onClick={handleConfirmAndContinue}
               className="bg-emerald-600 text-white hover:bg-emerald-500"
>
               Continue to marketplaces 
             </Button>
           </div>
         </CardContent>
       </Card>
     </div>
   </div>
 );
}