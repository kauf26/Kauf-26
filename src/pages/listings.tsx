import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AppTabNav from "@/components/AppTabNav";
import { useProducts } from "@/hooks/use-products";
import type { ListingProduct } from "@/lib/productsFetch";
import { Loader2, Package, AlertCircle } from "lucide-react";

export default function Listings() {
  const { toast } = useToast();
  const {
    data: products = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useProducts();

  const handleManualPost = async (marketplace: string, product: ListingProduct) => {
    const text = `TITLE: ${product.originalTitle}\nPRICE: ${product.basePrice}\n\n${product.aiDescription}`;
    await navigator.clipboard.writeText(text);
    const url = marketplace === "stockx" ? "https://stockx.com/sell" : "https://poshmark.com/listing/new";
    window.open(url, "_blank");
    toast({ title: "Copied!", description: "Details ready to paste." });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <AlertCircle className="mx-auto text-destructive" />
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load products"}
            </p>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Retrying…" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <AppTabNav />
      <h1 className="text-3xl font-bold mb-8">Your Listings</h1>
      <div className="grid gap-6">
        {products.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Package className="mx-auto mb-4" />
              No products found.
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex gap-4">
                  <img src={product.imageUrl} className="w-24 h-24 object-cover rounded border" alt="" />
                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="bg-green-600" onClick={() => handleManualPost("stockx", product)}>
                      StockX Bridge
                    </Button>
                    <Button size="sm" className="bg-blue-600" onClick={() => handleManualPost("poshmark", product)}>
                      Poshmark Bridge
                    </Button>
                  </div>
                  <Badge className="ml-auto">
                    {product.currency} {product.basePrice}
                  </Badge>
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
