import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MARKETPLACES } from "@/config/marketplaces";
import { Trash2, Loader2, Package, Hash, RefreshCw, ExternalLink } from "lucide-react";

interface Product {
  id: number;
  imageUrl: string;
  originalTitle: string;
  aiDescription: string;
  basePrice: string;
  currency: string;
  quantity: number;
  createdAt: string;
}

interface Listing {
  id: number;
  productId: number;
  marketplace: string;
  translatedTitle: string;
  translatedDescription: string;
  localPrice: string;
  localCurrency: string;
  status: string;
}

export default function Listings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["listings"],
    queryFn: async () => {
      const res = await fetch("/api/listings");
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
  });

  const deleteListingsMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/listings/product/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete listings");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({
        title: "Listings Deleted",
        description: "All marketplace listings have been removed.",
      });
    },
  });

  const getProductListings = (productId: number) => {
    return listings.filter((l) => l.productId === productId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Your Listings</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage all your marketplace listings in one place
          </p>
        </div>

        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by uploading your first product
              </p>
              <Button onClick={() => (window.location.href = "/")} data-testid="button-upload-first">
                Upload Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {products.map((product) => {
              const productListings = getProductListings(product.id);
              return (
                <Card key={product.id} data-testid={`card-product-${product.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <img
                          src={product.imageUrl}
                          alt={product.originalTitle}
                          className="w-24 h-24 object-cover rounded-lg border"
                          data-testid={`img-product-${product.id}`}
                        />
                        <div>
                          <CardTitle className="mb-1" data-testid={`text-title-${product.id}`}>
                            {product.originalTitle}
                          </CardTitle>
                          <CardDescription data-testid={`text-description-${product.id}`}>
                            {product.aiDescription}
                          </CardDescription>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" data-testid={`badge-price-${product.id}`}>
                              {product.currency} {product.basePrice}
                            </Badge>
                            <Badge
                              variant={product.quantity === 0 ? "destructive" : "secondary"}
                              className="flex items-center gap-1"
                              data-testid={`badge-quantity-${product.id}`}
                            >
                              <Hash className="w-3 h-3" />
                              {product.quantity === 0 ? "Sold Out" : `${product.quantity} in stock`}
                            </Badge>
                            {product.quantity === 0 && (
                              <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-900/60 to-purple-700/40 border border-purple-500/40 rounded-full px-2.5 py-1" data-testid={`badge-sold-kauf-${product.id}`}>
                                <img src="/kauf-logo.jpeg" alt="KAUF" className="w-4 h-4 rounded-sm object-cover" />
                                <span className="text-xs font-semibold text-purple-200">Sold with KAUF</span>
                              </div>
                            )}
                            <Badge variant="secondary" data-testid={`badge-count-${product.id}`}>
                              {productListings.length} Listings
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteListingsMutation.mutate(product.id)}
                        disabled={deleteListingsMutation.isPending}
                        data-testid={`button-delete-${product.id}`}
                      >
                        {deleteListingsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete All
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {productListings.map((listing) => (
                        <div
                          key={listing.id}
                          className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          data-testid={`listing-${listing.id}`}
                        >
                          <div className="font-semibold text-sm mb-1 capitalize">
                            {listing.marketplace}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {listing.translatedTitle.substring(0, 30)}...
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {listing.localCurrency} {parseFloat(listing.localPrice).toFixed(2)}
                            </span>
                            {listing.status === "sold_out" ? (
                              <div className="flex items-center gap-1 bg-gradient-to-r from-purple-900/60 to-purple-700/40 border border-purple-500/40 rounded-full px-2 py-0.5">
                                <img src="/kauf-logo.jpeg" alt="KAUF" className="w-3 h-3 rounded-sm object-cover" />
                                <span className="text-xs font-semibold text-purple-200">Sold with KAUF</span>
                              </div>
                            ) : (
                              <Badge
                                variant={listing.status === "active" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {listing.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-4 pt-4 border-t border-border"
                      data-testid={`marketplaces-section-${product.id}`}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
                        Marketplaces
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {MARKETPLACES.map((mp) => (
                          <Badge
                            key={mp.slug}
                            variant="secondary"
                            className="inline-flex max-w-full items-center gap-1 px-2.5 py-1 text-[11px] font-medium leading-none"
                            data-testid={`marketplace-badge-${product.id}-${mp.slug}`}
                            title={
                              mp.integrationType === "API"
                                ? `${mp.name} — API integration (sync)`
                                : `${mp.name} — manual integration`
                            }
                          >
                            {mp.integrationType === "API" ? (
                              <RefreshCw
                                className="size-3 shrink-0 opacity-80"
                                strokeWidth={2.25}
                                aria-hidden
                              />
                            ) : (
                              <ExternalLink
                                className="size-3 shrink-0 opacity-80"
                                strokeWidth={2.25}
                                aria-hidden
                              />
                            )}
                            <span className="min-w-0 truncate">{mp.name}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
