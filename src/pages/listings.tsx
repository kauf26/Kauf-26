import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppTabNav from "@/components/AppTabNav";
import { useListings } from "@/hooks/use-listings";
import { truncateListingUrl } from "@shared/marketplaceListingUrl";
import { ExternalLink, Loader2, Package, AlertCircle } from "lucide-react";

export default function Listings() {
  const {
    data: listings = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useListings();

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
              {error instanceof Error ? error.message : "Failed to load published listings"}
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
      <h1 className="text-3xl font-bold mb-2">Published Products</h1>
      <p className="text-muted-foreground mb-8">
        Live marketplace listings with direct links to view each product online.
      </p>
      <div className="grid gap-6">
        {listings.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Package className="mx-auto mb-4" />
              No published listings yet.
            </CardContent>
          </Card>
        ) : (
          listings.map((listing) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex gap-4 items-start">
                  {listing.imageUrl ? (
                    <img
                      src={listing.imageUrl}
                      className="w-24 h-24 object-cover rounded border shrink-0"
                      alt=""
                    />
                  ) : (
                    <div className="w-24 h-24 rounded border bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {listing.marketplace}
                      </Badge>
                      <Badge
                        variant={listing.status === "active" ? "default" : "outline"}
                        className="capitalize"
                      >
                        {listing.status}
                      </Badge>
                      <Badge className="ml-auto">
                        {listing.currency} {listing.price}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{listing.title}</CardTitle>
                    {listing.listingUrl ? (
                      <div className="space-y-2">
                        <a
                          href={listing.listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          View live listing
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <CardDescription className="font-mono text-xs break-all">
                          {truncateListingUrl(listing.listingUrl, 72)}
                        </CardDescription>
                      </div>
                    ) : (
                      <CardDescription>
                        Live URL unavailable
                        {listing.marketplaceListingId
                          ? ` (ID: ${listing.marketplaceListingId})`
                          : ""}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
