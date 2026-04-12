import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, BadgeCheck, Info, Plus, X } from "lucide-react";

interface AnalysisResult {
  imageUrl: string;
  title: string;
  description: string;
  exactMatch: boolean;
  suggestedPrice: number | null;
}

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

export default function Create() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
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
      setLocation("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setAnalysis(parsed);
      if (parsed.suggestedPrice) {
        setPrice(String(parsed.suggestedPrice));
      }
    } catch {
      setLocation("/");
    }
  }, [setLocation]);

  const handleAdditionalImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 5 - additionalImages.length;
    const toUpload = files.slice(0, remaining);
    setUploadingImages(true);
    try {
      const formData = new FormData();
      toUpload.forEach((f) => formData.append("images", f));
      const res = await fetch("/api/products/upload-additional", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setAdditionalImages((prev) => [...prev, ...data.urls]);
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload images. Please try again.", variant: "destructive" });
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
      if (!analysis || !price) throw new Error("Missing data");

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const productRes = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Timezone": timeZone,
        },
        body: JSON.stringify({
          imageUrl: analysis.imageUrl,
          additionalImages,
          originalTitle: analysis.title,
          aiDescription: analysis.description,
          basePrice: price,
          currency,
          quantity: parseInt(quantity) || 1,
        }),
      });
      if (productRes.status === 429) {
        const data = (await productRes.json()) as { message?: string; resetAt?: string };
        let msg = data.message || "Daily post limit reached";
        if (data.resetAt) {
          try {
            const t = new Date(data.resetAt);
            msg += ` Resets at ${t.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`;
          } catch {
            /* ignore */
          }
        }
        throw new Error(msg);
      }
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
    onError: (error: Error) => {
      const isLimitError = error.message.includes("trial") || error.message.includes("limit");
      toast({
        title: isLimitError ? "Daily Post Limit Reached" : "Listing Failed",
        description: isLimitError
          ? error.message
          : "Could not list product. Please try again.",
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Your Product</CardTitle>
                  <CardDescription>Edit the title and description if needed</CardDescription>
                </div>
                {analysis.exactMatch ? (
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Exact Match Found
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full shrink-0">
                    <Info className="w-3.5 h-3.5" />
                    AI Generated
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <img
                src={analysis.imageUrl}
                alt="Product"
                className="w-full h-64 object-cover rounded-lg border"
                data-testid="img-preview"
              />

              {/* Additional photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Additional Photos <span className="text-muted-foreground font-normal">({additionalImages.length}/5)</span></Label>
                </div>
                <input
                  ref={additionalInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAdditionalImages}
                  data-testid="input-additional-images"
                />
                <div className="grid grid-cols-3 gap-2">
                  {additionalImages.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border" data-testid={`img-additional-${i}`}>
                      <img src={url} alt={`Additional ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeAdditionalImage(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition-colors"
                        data-testid={`button-remove-image-${i}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {additionalImages.length < 5 && (
                    <button
                      onClick={() => additionalInputRef.current?.click()}
                      disabled={uploadingImages}
                      className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
                      data-testid="button-add-photo"
                    >
                      {uploadingImages ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          <span className="text-xs font-medium">Add Photo</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

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
                  <div className="flex items-center gap-2">
                    <Label htmlFor="price">Price</Label>
                    {analysis?.suggestedPrice && (
                      <span className="text-xs text-muted-foreground">(AI suggested)</span>
                    )}
                  </div>
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
                        <div className="font-medium text-sm">{m.country} {m.name}</div>
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
