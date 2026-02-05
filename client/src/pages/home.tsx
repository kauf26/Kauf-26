import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, ShoppingBag, Globe } from "lucide-react";

interface AnalysisResult {
  imageUrl: string;
  title: string;
  description: string;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [condition, setCondition] = useState<"new" | "used">("new");
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([
    "ebay",
    "amazon",
    "etsy",
  ]);

  const marketplaces = [
    { id: "ebay", name: "eBay", currency: "USD" },
    { id: "amazon", name: "Amazon", currency: "USD" },
    { id: "etsy", name: "Etsy", currency: "USD" },
    { id: "shopify", name: "Shopify", currency: "USD" },
    { id: "woocommerce", name: "WooCommerce", currency: "USD" },
    { id: "mercadolibre", name: "Mercado Libre", currency: "MXN" },
    { id: "rakuten", name: "Rakuten", currency: "JPY" },
    { id: "depop", name: "Depop", currency: "GBP" },
    { id: "vinted", name: "Vinted", currency: "EUR" },
    { id: "grailed", name: "Grailed", currency: "USD" },
    { id: "offerup", name: "OfferUp", currency: "USD" },
    { id: "bigcommerce", name: "BigCommerce", currency: "USD" },
  ];

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/products/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to analyze image");
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysis(data);
      toast({
        title: "Product Analyzed",
        description: "AI has generated a title and description for your product.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the product image. Please try again.",
        variant: "destructive",
      });
    },
  });

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
      toast({
        title: "Product Listed!",
        description: `Successfully listed on ${selectedMarketplaces.length} marketplaces with auto-translation.`,
      });
      setTimeout(() => setLocation("/listings"), 1500);
    },
    onError: () => {
      toast({
        title: "Listing Failed",
        description: "Could not list product to marketplaces. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysis(null);
    }
  };

  const handleAnalyze = () => {
    if (image) {
      analyzeMutation.mutate(image);
    }
  };

  const handleListProduct = () => {
    if (selectedMarketplaces.length === 0) {
      toast({
        title: "No Marketplaces Selected",
        description: "Please select at least one marketplace.",
        variant: "destructive",
      });
      return;
    }
    createProductMutation.mutate();
  };

  const toggleMarketplace = (id: string) => {
    setSelectedMarketplaces((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-primary mb-4">
            <Globe className="w-8 h-8" />
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Global Marketplace Lister
          </h1>
          <p className="text-muted-foreground text-lg">
            Snap a photo, generate AI descriptions, and list worldwide with automatic translation
          </p>
        </div>

        <div className="grid gap-6">
          <Card data-testid="card-upload">
            <CardHeader>
              <CardTitle>1. Upload Product Photo</CardTitle>
              <CardDescription>
                Take or upload a photo of your product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="image-upload">Product Image</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="mt-2"
                    data-testid="input-image"
                  />
                </div>

                {previewUrl && (
                  <div className="space-y-4">
                    <img
                      src={previewUrl}
                      alt="Product preview"
                      className="w-full h-64 object-cover rounded-lg border"
                      data-testid="img-preview"
                    />
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzeMutation.isPending}
                      className="w-full"
                      data-testid="button-analyze"
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing with AI...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Generate AI Description
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {analysis && (
            <Card data-testid="card-analysis">
              <CardHeader>
                <CardTitle>2. Review AI-Generated Details</CardTitle>
                <CardDescription>
                  Edit the title and description if needed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Product Title</Label>
                  <Input
                    id="title"
                    value={analysis.title}
                    onChange={(e) =>
                      setAnalysis({ ...analysis, title: e.target.value })
                    }
                    className="mt-2"
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (3 sentences)</Label>
                  <Textarea
                    id="description"
                    value={analysis.description}
                    onChange={(e) =>
                      setAnalysis({ ...analysis, description: e.target.value })
                    }
                    rows={4}
                    className="mt-2"
                    data-testid="textarea-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Base Price</Label>
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

                <div className="mt-4">
                  <Label>Condition</Label>
                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setCondition("new")}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        condition === "new"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid="button-condition-new"
                    >
                      New
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondition("used")}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        condition === "used"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid="button-condition-used"
                    >
                      Used
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && price && (
            <Card data-testid="card-marketplaces">
              <CardHeader>
                <CardTitle>3. Select Marketplaces</CardTitle>
                <CardDescription>
                  Choose where to list your product. Auto-translation included.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {marketplaces.map((marketplace) => (
                    <label
                      key={marketplace.id}
                      className="flex items-start space-x-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`label-marketplace-${marketplace.id}`}
                    >
                      <Checkbox
                        checked={selectedMarketplaces.includes(marketplace.id)}
                        onCheckedChange={() => toggleMarketplace(marketplace.id)}
                        data-testid={`checkbox-marketplace-${marketplace.id}`}
                      />
                      <div>
                        <div className="font-medium text-sm">{marketplace.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {marketplace.currency}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <Button
                  onClick={handleListProduct}
                  disabled={createProductMutation.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-list"
                >
                  {createProductMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Listing on {selectedMarketplaces.length} Marketplaces...
                    </>
                  ) : (
                    `List on ${selectedMarketplaces.length} Marketplaces`
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
