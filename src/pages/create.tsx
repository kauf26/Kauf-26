import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

type ProductDraft = {
 capturedImage: string;
 title?: string;
 description?: string;
 price?: string;
 // add other fields as needed
};

export default function Create() {
 const navigate = useNavigate();
 const [draft, setDraft] = useState<ProductDraft | null>(null);
 const [isEditing, setIsEditing] = useState(false);

 useEffect(() => {
   // Retrieve scraped product data from sessionStorage
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
   sessionStorage.removeItem("pendingAnalysis");
   navigate("/capture"); // or wherever the camera/scanner page is
 };

 const handleConfirmAndContinue = () => {
   // Save final edited data back to sessionStorage or context
   sessionStorage.setItem("pendingAnalysis", JSON.stringify(draft));
   navigate("/marketplace-selection"); // next page to post to multiple marketplaces
 };

 if (!draft) {
   return <div className="p-8 text-center">Loading product data…</div>;
 }

 return (
   <div className="min-h-screen bg-background">
     <div className="container max-w-2xl mx-auto py-6 px-4">
       {/* Start Over Button */}
       <Button variant="ghost" onClick={handleStartOver} className="mb-4">
         <ArrowLeft className="w-4 h-4 mr-2" />
         Start over
       </Button>

       <Card className="mb-6">
         <CardHeader>
           <CardTitle>Your Product</CardTitle>
           <CardDescription>Review and edit before listing</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <img
             src={draft.capturedImage}
             alt="Product preview"
             className="w-full h-64 object-cover rounded-lg border border-gray-200"
           />
           {/* Editable fields – example */}
           <div className="space-y-2">
             <label className="text-sm font-medium">Title</label>
             <input
               type="text"
               value={draft.title || ""}
               onChange={(e) => setDraft({ ...draft, title: e.target.value })}
               className="w-full p-2 border rounded-md"
               disabled={!isEditing}
             />
           </div>
           <div className="space-y-2">
             <label className="text-sm font-medium">Price</label>
             <input
               type="text"
               value={draft.price || ""}
               onChange={(e) => setDraft({ ...draft, price: e.target.value })}
               className="w-full p-2 border rounded-md"
               disabled={!isEditing}
             />
           </div>
           <div className="flex gap-2 justify-end">
             <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
               {isEditing ? "Cancel" : "Edit"}
             </Button>
             <Button onClick={handleConfirmAndContinue}>
               Continue to marketplaces →
             </Button>
           </div>
         </CardContent>
       </Card>
     </div>
   </div>
 );
}