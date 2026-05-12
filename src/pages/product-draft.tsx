import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProductDraftPage() {
 const [price, setPrice] = useState("5");
 const [condition, setCondition] = useState("used");

 return (
   <div className="min-h-screen bg-black text-white p-6 font-sans">
     <div className="max-w-md mx-auto space-y-8">
       {/* Header */}
       <div className="text-center">
         <h1 className="text-2xl font-bold tracking-tighter">KAUF-AI</h1>
         <p className="text-xs text-gray-500 uppercase tracking-widest">Picture ✨ Post ✨ Sell</p>
       </div>

       {/* 1. Basic Info Section */}
       <div className="space-y-4">
         <div>
           <Label className="text-gray-400">Product Title</Label>
           <Input className="bg-zinc-900 border-zinc-800 text-white" placeholder="Loading title..." />
         </div>

         <div>
           <Label className="text-gray-400">Description</Label>
           <Textarea
             className="bg-zinc-900 border-zinc-800 text-white min-h-[100px]"
             placeholder="AI-generated description will appear here..."
           />
         </div>
       </div>

       {/* 2. Pricing & Condition */}
       <div className="grid grid-cols-2 gap-4">
         <div>
           <Label className="text-gray-400">Base Price</Label>
           <Input
             type="number"
             value={price}
             onChange={(e) => setPrice(e.target.value)}
             className="bg-zinc-900 border-zinc-800"
           />
         </div>
         <div>
           <Label className="text-gray-400">Condition</Label>
           <Select value={condition} onValueChange={setCondition}>
             <SelectTrigger className="bg-zinc-900 border-zinc-800">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="new">New</SelectItem>
               <SelectItem value="used">Used</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </div>

       {/* 3. Marketplace Selection (Based on your image) */}
       <div className="space-y-4">
         <h3 className="text-lg font-semibold">3. Select Marketplaces</h3>
         <div className="grid grid-cols-2 gap-3">
           {["eBay", "Amazon", "Etsy", "Shopify", "WooCommerce", "Depop"].map((market) => (
             <Card key={market} className="bg-zinc-900 border-zinc-800">
               <CardContent className="p-4 flex items-center justify-between">
                 <span className="text-sm font-medium">{market}</span>
                 <Checkbox className="border-zinc-700 data-[state=checked]:bg-blue-600" />
               </CardContent>
             </Card>
           ))}
         </div>
       </div>

       {/* Action Button */}
       <Button className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg font-bold rounded-xl">
         POST TO MARKETPLACES
       </Button>
     </div>
   </div>
 );
}
