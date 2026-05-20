import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";

const localMarketplaces = [
 { id: "ebay", name: "eBay", currency: "USD", country: "🇺🇸" },
 { id: "amazon", name: "Amazon", currency: "USD", country: "🇺🇸" },
 { id: "mercari", name: "Mercari US", currency: "USD", country: "🇺🇸" },
 { id: "mercari-jp", name: "Mercari Japan", currency: "JPY", country: "🇯🇵" },
 { id: "stockx", name: "StockX", currency: "USD", country: "🇺🇸" },
 { id: "grailed", name: "Grailed", currency: "USD", country: "🇺🇸" },
 { id: "whatnot", name: "Whatnot", currency: "USD", country: "🇺🇸" },
 { id: "tcgplayer", name: "TCGplayer", currency: "USD", country: "🇺🇸" },
 { id: "discogs", name: "Discogs", currency: "USD", country: "🇺🇸" },
 { id: "poshmark", name: "Poshmark", currency: "USD", country: "🇺🇸" },
 { id: "gumtree", name: "Gumtree", currency: "AUD", country: "🇦🇺" },
];

const globalMarketplaces = [
 { id: "etsy", name: "Etsy", currency: "USD", country: "🇺🇸" },
 { id: "shopify", name: "Shopify", currency: "USD", country: "🇨🇦" },
 { id: "woocommerce", name: "WooCommerce", currency: "USD", country: "🇺🇸" },
 { id: "squarespace", name: "Squarespace", currency: "USD", country: "🇺🇸" },
 { id: "wix", name: "Wix eCommerce", currency: "USD", country: "🇮🇱" },
 { id: "prestashop", name: "PrestaShop", currency: "EUR", country: "🇫🇷" },
 { id: "mercadolibre", name: "Mercado Libre", currency: "USD", country: "🇲🇽" },
 { id: "pinterest", name: "Pinterest", currency: "USD", country: "🇺🇸" },
 { id: "tiktokshop", name: "TikTok Shop", currency: "USD", country: "🌏" },
 { id: "wallapop", name: "Wallapop", currency: "EUR", country: "🇪🇸" },
 { id: "vinted", name: "Vinted", currency: "EUR", country: "🇪🇺" },
 { id: "shopee", name: "Shopee", currency: "BRL", country: "🇧🇷" },
 { id: "olx", name: "OLX", currency: "BRL", country: "🇧🇷" },
 { id: "falabella", name: "Falabella", currency: "USD", country: "🇨🇱" },
 { id: "bolcom", name: "Bol.com", currency: "EUR", country: "🇳🇱" },
];

interface DraftData {
 capturedImage: string;
 modelName: string;
 brand: string;
 year: string | number;
 condition: string;
 refNumber: string;
 material: string;
 aiDescription: string;
 allegroAvg: number | string;
 ebayAvg: number | string;
 recommendedPrice: number | string;
}

export default function Create() {
 const [, setLocation] = useLocation();
 const { toast } = useToast();

 const [draft, setDraft] = useState<DraftData | null>(null);
 const [price, setPrice] = useState("");
 const [quantity, setQuantity] = useState("1");
 const [currency, setCurrency] = useState("USD");
 const [condition, setCondition] = useState<"new" | "used">("new");
 const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(["ebay", "etsy"]);
 const [additionalImages, setAdditionalImages] = useState<string[]>([]);
 const [uploadingImages, setUploadingImages] = useState(false);
 const additionalInputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
   const raw = sessionStorage.getItem("pendingAnalysis");
   if (!raw) {
     toast({ title: "No draft found", description: "Please start from the home page.", variant: "destructive" });
     setLocation("/");
     return;
   }
   try {
     const parsed = JSON.parse(raw) as DraftData;
     setDraft(parsed);
     if (parsed.recommendedPrice) {
       setPrice(String(parsed.recommendedPrice));
     }
   } catch {
     setLocation("/");
   }
 }, [setLocation, toast]);

 const handleAdditionalImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
   const files = Array.from(e.target.files || []);
   if (!files.length) return;
   const remaining = 5 - additionalImages.length;
   const toUpload = files.slice(0, remaining);
   setUploadingImages(true);
   try {
     const formData = new FormData();
     toUpload.forEach((f) => formData.append("images", f));
     const res = await fetch("/api/products/upload-additional", {
       method: "POST",
       headers: { "X-Client-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone },
       body: formData,
     });
     if (!res.ok) throw new Error("Upload failed");
     const data = await res.json();
     setAdditionalImages((prev) => [...prev, ...data.urls]);
   } catch {
     toast({ title: "Upload Failed", description: "Could not upload images.", variant: "destructive" });
   } finally {
     setUploadingImages(false);
     if (additionalInputRef.current) additionalInputRef.current.value = "";
   }
 };

 const removeAdditionalImage = (index: number) => {
   setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
 };

 const createProductMutation = useMutation({
   mutationFn: async () => {
     if (!draft || !price) throw new Error("Missing product data or price");
     const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
     const productRes = await fetch("/api/products", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "X-Client-Timezone": timeZone,
       },
       body: JSON.stringify({
         imageUrl: draft.capturedImage,
         additionalImages,
         originalTitle: draft.modelName,
         aiDescription: draft.aiDescription,
         basePrice: price,
         currency,
         quantity: parseInt(quantity) || 1,
         condition,
       }),
     });
     if (productRes.status === 429) {
       const data = await productRes.json();
       throw new Error(data.message || "Daily post limit reached");
     }
     if (!productRes.ok) throw new Error("Failed to create product");
     const created = await productRes.json();
     const listRes = await fetch(`/api/products/${created.id}/list`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ selectedMarketplaces }),
     });
     if (!listRes.ok) throw new Error("Failed to create listings");
     return created;
   },
   onSuccess: () => {
     sessionStorage.removeItem("pendingAnalysis");
     toast({
       title: "Product Listed!",
       description: `Listed on ${selectedMarketplaces.length} marketplaces.`,
     });
     setTimeout(() => setLocation("/listings"), 1200);
   },
   onError: (error: Error) => {
     toast({
       title: "Listing Failed",
       description: error.message,
       variant: "destructive",
     });
   },
 });

 const handleListProduct = () => {
   if (!price) {
     toast({ title: "Enter a price", description: "Price required.", variant: "destructive" });
     return;
   }
   if (selectedMarketplaces.length === 0) {
     toast({ title: "No Marketplaces", description: "Select at least one.", variant: "destructive" });
     return;
   }
   createProductMutation.mutate();
 };

 const toggleMarketplace = (id: string) => {
   setSelectedMarketplaces((prev) =>
     prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
   );
 };

 if (!draft) {
   return (
     <div className="min-h-screen flex items-center justify-center">
       <Loader2 className="w-8 h-8 animate-spin text-primary" />
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-background">
     <div className="container max-w-2xl mx-auto py-6 px-4">
       <button
         onClick={() => {
           sessionStorage.removeItem("pendingAnalysis");
           setLocation("/");
         }}
         className="flex items-center gap-1 text-sm text-muted-foreground mb-6"

         <ArrowLeft className="w-4 h-4" /> Start over
       </button>

       <div className="space-y-6">
         {/* Product Card */}
         <Card>
           <CardHeader>
             <CardTitle>Your Product</CardTitle>
             <CardDescription>Review and edit before listing</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <img
               src={draft.capturedImage}
               alt="Product"
               className="w-full h-64 object-cover rounded-lg border"
             />

             {/* Additional photos */}
             <div>
               <div className="flex items-center justify-between mb-2">
                 <Label>Additional Photos <span className="text-muted-foreground">({additionalImages.length}/5)</span></Label>
               </div>
               <input
                 ref={additionalInputRef}
                 type="file"
                 accept="image/*"
                 multiple
                 className="hidden"
                 onChange={handleAdditionalImages}
               />
               <div className="grid grid-cols-3 gap-2">
                 {additionalImages.map((url, i) => (
                   <div key={i} className="relative aspect-square rounded-lg border overflow-hidden">
                     <img src={url} alt={`additional ${i}`} className="w-full h-full object-cover" />
                     <button
                       onClick={() => removeAdditionalImage(i)}
                       className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"

                       <X className="w-3.5 h-3.5 text-white" />
                     </button>
                   </div>
                 ))}
                 {additionalImages.length < 5 && (
                   <button
                     onClick={() => additionalInputRef.current?.click()}
                     disabled={uploadingImages}
                     className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center"

                     {uploadingImages ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                   </button>
                 )}
               </div>
             </div>

             <div>
               <Label htmlFor="title">Title</Label>
               <Input
                 id="title"
                 value={draft.modelName}
                 onChange={(e) => setDraft({ ...draft, modelName: e.target.value })}
                 className="mt-2"
               />
             </div>

             <div>
               <Label htmlFor="description">Description</Label>
               <Textarea
                 id="description"
                 value={draft.aiDescription}
                 onChange={(e) => setDraft({ ...draft, aiDescription: e.target.value })}
                 rows={4}
                 className="mt-2"
               />
             </div>
           </CardContent>
         </Card>

         {/* Pricing Card */}
         <Card>
           <CardHeader>
             <CardTitle>Price & Condition</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="grid grid-cols-3 gap-4">
               <div>
                 <Label htmlFor="price">Price</Label>
                 <Input
                   id="price"
                   type="number"
                   step="0.01"
                   value={price}
                   onChange={(e) => setPrice(e.target.value)}
                   placeholder="0.00"
                 />
               </div>
               <div>
                 <Label htmlFor="quantity">Quantity</Label>
                 <Input
                   id="quantity"
                   type="number"
                   min="1"
                   value={quantity}
                   onChange={(e) => setQuantity(e.target.value)}
                 />
               </div>
               <div>
                 <Label htmlFor="currency">Currency</Label>
                 <select
                   id="currency"
                   value={currency}
                   onChange={(e) => setCurrency(e.target.value)}
                   className="w-full rounded-md border p-2"

                   <option value="USD">USD</option>
                   <option value="EUR">EUR</option>
                   <option value="GBP">GBP</option>
                   <option value="JPY">JPY</option>
                 </select>
               </div>
             </div>
             <div>
               <Label>Condition</Label>
               <div className="flex gap-4 mt-2">
                 {(["new", "used"] as const).map((c) => (
                   <button
                     key={c}
                     type="button"
                     onClick={() => setCondition(c)}
                     className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium capitalize ${
                       condition === c ? "border-primary bg-primary/10 text-primary" : "border-border"
                     }`}

                     {c}
                   </button>
                 ))}
               </div>
             </div>
           </CardContent>
         </Card>

         {/* Marketplaces Card */}
         <Card>
           <CardHeader>
             <CardTitle>Select Marketplaces</CardTitle>
             <CardDescription>Auto-translation included for international platforms</CardDescription>
           </CardHeader>
           <CardContent className="space-y-5">
             <div>
               <p className="text-xs font-semibold uppercase mb-3">Local</p>
               <div className="grid grid-cols-2 gap-2">
                 {localMarketplaces.map((m) => (
                   <label key={m.id} className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg">
                     <Checkbox
                       checked={selectedMarketplaces.includes(m.id)}
                       onCheckedChange={() => toggleMarketplace(m.id)}
                     />
                     <div>
                       <div className="font-medium text-sm">{m.country} {m.name}</div>
                       <div className="text-xs text-muted-foreground">{m.currency}</div>
                     </div>
                   </label>
                 ))}
               </div>
             </div>
             <div>
               <p className="text-xs font-semibold uppercase mb-3">Global</p>
               <div className="grid grid-cols-2 gap-2">
                 {globalMarketplaces.map((m) => (
                   <label key={m.id} className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg">
                     <Checkbox
                       checked={selectedMarketplaces.includes(m.id)}
                       onCheckedChange={() => toggleMarketplace(m.id)}
                     />
                     <div>
                       <div className="font-medium text-sm">{m.country} {m.name}</div>
                       <div className="text-xs text-muted-foreground">{m.currency}</div>
                     </div>
                   </label>
                 ))}
               </div>
             </div>
             <Button
               onClick={handleListProduct}
               disabled={createProductMutation.isPending || !price}
               className="w-full"
               size="lg"

               {createProductMutation.isPending ? (
                 <>
                   <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                   Listing on {selectedMarketplaces.length} marketplaces…
                 </>
               ) : (
                 `List on ${selectedMarketplaces.length} marketplace${selectedMarketplaces.length !== 1 ? "s" : ""}`
               )}
             </Button>
           </CardContent>
         </Card>
       </div>
     </div>
   </div>
 );
}