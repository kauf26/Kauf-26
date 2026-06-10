import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSales } from "@/hooks/use-sales";
import {
  DEFAULT_FROM_ADDRESS,
  fetchShippingRates,
  generateShippingLabel,
  markShippingLabelCreated,
  parseBuyerAddress,
  type ShippingAddress,
  type ShippingRate,
} from "@/lib/salesFetch";
import { Loader2, Package, Printer } from "lucide-react";

function readSaleIdFromSearch(): number | null {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("saleId"));
  return Number.isFinite(id) ? id : null;
}

function AddressFields({
  prefix,
  value,
  onChange,
  readOnly = false,
}: {
  prefix: string;
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  readOnly?: boolean;
}) {
  const set = (key: keyof ShippingAddress, val: string) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(
        [
          ["name", "Name"],
          ["line1", "Address line 1"],
          ["line2", "Address line 2"],
          ["city", "City"],
          ["state", "State"],
          ["postalCode", "ZIP"],
          ["country", "Country"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className={key === "line1" ? "md:col-span-2" : ""}>
          <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
          <Input
            id={`${prefix}-${key}`}
            value={value[key] ?? ""}
            readOnly={readOnly}
            onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

export default function ShippingLabelsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: sales = [], isFetching } = useSales();

  const saleIdFromUrl = useMemo(() => readSaleIdFromSearch(), []);
  const [selectedSaleId, setSelectedSaleId] = useState<number | "">(
    saleIdFromUrl ?? ""
  );

  const selectedSale = sales.find((s) => s.id === Number(selectedSaleId));

  const [fromAddress, setFromAddress] = useState<ShippingAddress>(DEFAULT_FROM_ADDRESS);
  const [toAddress, setToAddress] = useState<ShippingAddress>({
    name: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [weightLbs, setWeightLbs] = useState("1");
  const [lengthIn, setLengthIn] = useState("10");
  const [widthIn, setWidthIn] = useState("10");
  const [heightIn, setHeightIn] = useState("10");
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!selectedSale) return;
    setToAddress(parseBuyerAddress(selectedSale.buyerInfo));
  }, [selectedSale?.id, selectedSale?.buyerInfo]);

  const handleGetRates = async () => {
    setIsLoadingRates(true);
    try {
      const next = await fetchShippingRates(parseFloat(weightLbs) || 1);
      setRates(next);
      if (next[0]) setSelectedService(next[0].service);
    } catch (err) {
      toast({
        title: "Rates unavailable",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRates(false);
    }
  };

  const handleGenerate = async () => {
    const saleId = Number(selectedSaleId);
    if (!Number.isFinite(saleId)) {
      toast({ title: "Select a sale", variant: "destructive" });
      return;
    }
    if (!selectedService) {
      toast({ title: "Select a shipping service", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateShippingLabel({
        saleId,
        fromAddress,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
        service: selectedService,
      });
      await markShippingLabelCreated(saleId);
      setLabelUrl(result.labelPdfUrl);
      setTrackingNumber(result.trackingNumber);
      toast({ title: "Label generated", description: `Tracking ${result.trackingNumber}` });
    } catch (err) {
      toast({
        title: "Label failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Shipping Labels</h1>
            </div>
            <p className="text-muted-foreground">
              Generate mock labels for sold items (PDF download).
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select sale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedSaleId}
              onChange={(e) =>
                setSelectedSaleId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={isFetching}
            >
              <option value="">Choose a sale…</option>
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  #{sale.id} — {sale.productTitle ?? "Product"} ({sale.marketplace ?? "marketplace"})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ship from</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressFields prefix="from" value={fromAddress} onChange={setFromAddress} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ship to</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressFields prefix="to" value={toAddress} onChange={setToAddress} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Package</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="weight">Weight (lb)</Label>
              <Input id="weight" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="length">Length (in)</Label>
              <Input id="length" value={lengthIn} onChange={(e) => setLengthIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="width">Width (in)</Label>
              <Input id="width" value={widthIn} onChange={(e) => setWidthIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="height">Height (in)</Label>
              <Input id="height" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleGetRates} disabled={isLoadingRates}>
            {isLoadingRates ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Get Rates
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !selectedSaleId}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
            Buy &amp; Print Label
          </Button>
        </div>

        {rates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rates.map((rate) => (
                <label
                  key={`${rate.carrier}-${rate.service}`}
                  className="flex items-center justify-between rounded-md border border-input px-3 py-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="service"
                      checked={selectedService === rate.service}
                      onChange={() => setSelectedService(rate.service)}
                    />
                    {rate.carrier} — {rate.service} ({rate.etaDays} days)
                  </span>
                  <span className="font-semibold">${rate.price.toFixed(2)}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        {labelUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Label ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trackingNumber && (
                <p className="text-sm text-muted-foreground">
                  Tracking: <span className="font-mono text-foreground">{trackingNumber}</span>
                </p>
              )}
              <div className="flex gap-3">
                <Button asChild>
                  <a href={labelUrl} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
