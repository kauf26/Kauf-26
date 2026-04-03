import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

interface AnalysisResult {
  imageUrl: string;
  title: string;
  description: string;
}

const localMarketplaces = [
  { id: "ebay", name: "eBay", currency: "USD" },
  { id: "amazon", name: "Amazon", currency: "USD" },
  { id: "walmart", name: "Walmart", currency: "USD" },
  { id: "wish", name: "Wish", currency: "USD" },
  { id: "reverb", name: "Reverb", currency: "USD" },
];

const globalMarketplaces = [
  { id: "etsy", name: "Etsy", currency: "USD" },
  { id: "shopify", name: "Shopify", currency: "USD" },
  { id: "woocommerce", name: "WooCommerce", currency: "USD" },
  { id: "aliexpress", name: "AliExpress", currency: "USD" },
  { id: "mercadolibre", name: "Mercado Libre", currency: "MXN" },
  { id: "rakuten", name: "Rakuten", currency: "JPY" },
  { id: "bigcommerce", name: "BigCommerce", currency: "USD" },
  { id: "prestashop", name: "PrestaShop", currency: "EUR" },
];

export default function Create() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [currency, setCurrency] = useState("USD");
  const [condition, setCondition] = useState<"new" | "used">("new");
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(["ebay", "amazon", "etsy"]);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingAnalysis");
    if (!raw) {
      setLocation("/");
      return;
    }
    try {
      setAnalysis(JSON.parse(raw));
    } catch {
      setLocation("/");
    }
  }, [setLocation]);

  const createProductMutation = useMutation({
    mutationFn: async () => {
      if (!analysis || !price) throw new Error("Missing data");

      const productRes = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: analysis.imageUrl,
          originalTitle: analysis.title,
          aiDescription: analysis.description,
          basePrice: price,
          currency,
          quantity: parseInt(quantity) || 1,
        }),
      });
      if (!productRes.ok) throw new Error("Failed to create product");
      const product = await productRes.json();

      const listRes = await fetch(`/api/products/${product.id}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedMarketplaces }),
      });
      if (!listRes.ok) throw new Error("Failed to create listings");

      return product;
    },
    onSuccess: () => {
      sessionStorage.removeItem("pendingAnalysis");
      toast({
        title: "Product Listed!",
        description: `Successfully listed on ${selectedMarketplaces.length} marketplaces.`,
      });
      setTimeout(() => setLocation("/listings"), 1200);
    },
    onError: () => {
      toast({
        title: "Listing Failed",
        description: "Could not list product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleListProduct = () => {
    if (!price) {
      toast({ title: "Enter a price", description: "A price is required before listing.", variant: "destructive" });
      return;
    }
    if (selectedMarketplaces.length === 0) {
      toast({ title: "No Marketplaces Selected", description: "Please select at least one marketplace.", variant: "destructive" });
      return;
    }
    createProductMutation.mutate();
  };

  const toggleMarketplace = (id: string) => {
    setSelectedMarketplaces((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  if (!analysis) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-6 px-4">

        <button
          onClick={() => { sessionStorage.removeItem("pendingAnalysis"); setLocation("/"); }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" /> Take another photo
        </button>

        <div className="space-y-6">
          {/* Photo + AI details */}
          <Card data-testid="card-analysis">
            <CardHeader>
              <CardTitle>Your Product</CardTitle>
              <CardDescription>Edit the title and description if needed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <img
                src={analysis.imageUrl}
                alt="Product"
                className="w-full h-64 object-cover rounded-lg border"
                data-testid="img-preview"
              />
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={analysis.title}
                  onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })}
                  className="mt-2"
                  data-testid="input-title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={analysis.description}
                  onChange={(e) => setAnalysis({ ...analysis, description: e.target.value })}
                  rows={4}
                  className="mt-2"
                  data-testid="textarea-description"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card data-testid="card-pricing">
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
                    className="mt-2"
                    data-testid="input-price"
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
                    className="mt-2"
                    data-testid="input-quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-currency"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="MXN">MXN</option>
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
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium capitalize transition-all ${
                        condition === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`button-condition-${c}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marketplaces */}
          <Card data-testid="card-marketplaces">
            <CardHeader>
              <CardTitle>Select Marketplaces</CardTitle>
              <CardDescription>Auto-translation included for international platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Local</p>
                <div className="grid grid-cols-2 gap-2">
                  {localMarketplaces.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`label-marketplace-${m.id}`}
                    >
                      <Checkbox
                        checked={selectedMarketplaces.includes(m.id)}
                        onCheckedChange={() => toggleMarketplace(m.id)}
                        data-testid={`checkbox-marketplace-${m.id}`}
                      />
                      <div>
                        <div className="font-medium text-sm">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.currency}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Global</p>
                <div className="grid grid-cols-2 gap-2">
                  {globalMarketplaces.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`label-marketplace-${m.id}`}
                    >
                      <Checkbox
                        checked={selectedMarketplaces.includes(m.id)}
                        onCheckedChange={() => toggleMarketplace(m.id)}
                        data-testid={`checkbox-marketplace-${m.id}`}
                      />
                      <div>
                        <div className="font-medium text-sm">{m.name}</div>
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
                data-testid="button-list"
              >
                {createProductMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Listing on {selectedMarketplaces.length} Marketplaces…
                  </>
                ) : (
                  `List on ${selectedMarketplaces.length} Marketplace${selectedMarketplaces.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
