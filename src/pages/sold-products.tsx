import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppTabNav from "@/components/AppTabNav";
import {
  flattenSoldProducts,
  useSoldProducts,
} from "@/hooks/use-sold-products";
import { Loader2, PackageCheck } from "lucide-react";

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function SoldProductsPage() {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSoldProducts();

  const pages = data?.pages ?? [];
  const totalSoldProducts = pages[0]?.totalSoldProducts ?? 0;
  const products = flattenSoldProducts(pages);

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
        <AppTabNav />

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <PackageCheck className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Sold Products</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Distinct products with completed payment or fulfillment activity
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total sold products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary" data-testid="text-total-sold-products">
              {totalSoldProducts}
            </div>
          </CardContent>
        </Card>

        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No sold products yet</h3>
              <p className="text-muted-foreground">
                Products appear here once a sale is paid or shipped.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt=""
                      className="w-20 h-20 rounded-md border object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-md border bg-muted flex items-center justify-center shrink-0">
                      <PackageCheck className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {product.total_quantity_sold} sold · Last sale{" "}
                      {formatDate(product.most_recent_sale_date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold">
                      ${parseFloat(product.total_revenue).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total revenue</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
