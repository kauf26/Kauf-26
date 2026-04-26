import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

interface Product {
 id: number;
 imageUrl: string;
 originalTitle: string;
 aiDescription: string;
 basePrice: string;
 currency: string;
}

export default function Listings() {
 const { toast } = useToast();
 const { data: products = [], isLoading } = useQuery<Product[]>({
   queryKey: ["/api/products"],
 });

 const handleManualPost = async (marketplace: string, product: Product) => {
   const text = `TITLE: ${product.originalTitle}\nPRICE: ${product.basePrice}\n\n${product.aiDescription}`;
   await navigator.clipboard.writeText(text);
   const url = marketplace === 'stockx' ? "https://stockx.com/sell" : "https://poshmark.com/listing/new";
   window.open(url, "_blank");
   toast({ title: "Copied!", description: "Details ready to paste." });
 };

 if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

 return (
   <div className="container mx-auto py-8">
     <h1 className="text-3xl font-bold mb-8">Your Listings</h1>
     <div className="grid gap-6">
       {products.length === 0 ? (
         <Card><CardContent className="p-10 text-center"><Package className="mx-auto mb-4" />No products found.</CardContent></Card>
       ) : (
         products.map((product) => (
           <Card key={product.id}>
             <CardHeader>
               <div className="flex gap-4">
                 <img src={product.imageUrl} className="w-24 h-24 object-cover rounded border" alt="" />
                 <div className="flex flex-col gap-2">
                   <Button size="sm" className="bg-green-600" onClick={() => handleManualPost('stockx', product)}>StockX Bridge</Button>
                   <Button size="sm" className="bg-blue-600" onClick={() => handleManualPost('poshmark', product)}>Poshmark Bridge</Button>
                 </div>
                 <Badge className="ml-auto">{product.currency} {product.basePrice}</Badge>
               </div>
               <CardTitle className="mt-4">{product.originalTitle}</CardTitle>
               <CardDescription>{product.aiDescription}</CardDescription>
             </CardHeader>
           </Card>
         ))
       )}
     </div>
   </div>
 );
}

