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
  emailShippingLabel,
  fetchShippingRates,
  formatRateLabel,
  generateShippingLabel,
  getPrintLabelBlockReason,
  getShippingToPackageBlockReason,
  loadStoredShipFromAddress,
  markShippingLabelCreated,
  mergeShipFromAddress,
  parseBuyerAddress,
  saveStoredShipFromAddress,
  type ShippingAddress,
  type ShippingRate,
} from "@/lib/salesFetch";
import { Loader2, Package, Printer, Info } from "lucide-react";
import { ShippingLabelSummary } from "@/components/ShippingLabelSummary";
import { printShippingLabelPdf } from "@/lib/printShippingLabel";

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

  const [fromAddress, setFromAddress] = useState<ShippingAddress>(() =>
    loadStoredShipFromAddress()
  );
  const [toAddress, setToAddress] = useState<ShippingAddress>({
    name: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [weightLbs, setWeightLbs] = useState("1");
  const [weightOz, setWeightOz] = useState("0");
  const [lengthIn, setLengthIn] = useState("10");
  const [widthIn, setWidthIn] = useState("10");
  const [heightIn, setHeightIn] = useState("10");
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [ratesMeta, setRatesMeta] = useState<{
    source: string;
    distanceMiles: number | null;
    billableWeightLbs: number;
    shipDateLabel?: string;
    isInternational?: boolean;
  } | null>(null);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [labelFromAddress, setLabelFromAddress] = useState<ShippingAddress | null>(null);
  const [labelToAddress, setLabelToAddress] = useState<ShippingAddress | null>(null);
  const [labelCarrier, setLabelCarrier] = useState<string | null>(null);
  const [labelService, setLabelService] = useState<string | null>(null);
  const [labelEstimatedDelivery, setLabelEstimatedDelivery] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [isEmailing, setIsEmailing] = useState(false);

  useEffect(() => {
    saveStoredShipFromAddress(fromAddress);
  }, [fromAddress]);

  useEffect(() => {
    if (!selectedSale) return;
    setToAddress(parseBuyerAddress(selectedSale.buyerInfo));
  }, [selectedSale?.id, selectedSale?.buyerInfo]);

  const resolvedFrom = useMemo(
    () => mergeShipFromAddress(fromAddress, DEFAULT_FROM_ADDRESS),
    [fromAddress]
  );

  const ratesBlockReason = useMemo(
    () =>
      getShippingToPackageBlockReason({
        toAddress,
        weightLbs,
        weightOz,
        lengthIn,
        widthIn,
        heightIn,
      }),
    [toAddress, weightLbs, weightOz, lengthIn, widthIn, heightIn]
  );

  const printBlockReason = useMemo(
    () =>
      getPrintLabelBlockReason({
        fromAddress: resolvedFrom,
        toAddress,
        weightLbs,
        weightOz,
        lengthIn,
        widthIn,
        heightIn,
        selectedRateId,
        selectedService,
        defaultFromAddress: DEFAULT_FROM_ADDRESS,
      }),
    [
      resolvedFrom,
      toAddress,
      weightLbs,
      weightOz,
      lengthIn,
      widthIn,
      heightIn,
      selectedRateId,
      selectedService,
    ]
  );

  const canGetRates = ratesBlockReason == null;
  const canPrintLabel = printBlockReason == null;

  const handleGetRates = async () => {
    if (ratesBlockReason) {
      toast({ title: "Missing details", description: ratesBlockReason, variant: "destructive" });
      return;
    }
    setIsLoadingRates(true);
    setRates([]);
    setRatesMeta(null);
    try {
      const result = await fetchShippingRates({
        fromAddress: resolvedFrom,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          weightOz: parseFloat(weightOz) || 0,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
      });
      setRates(result.rates);
      setRatesMeta({
        source: result.source,
        distanceMiles: result.distanceMiles,
        billableWeightLbs: result.billableWeightLbs,
        shipDateLabel: result.shipDateLabel,
        isInternational: result.isInternational,
      });
      if (result.rates[0]) {
        setSelectedRateId(result.rates[0].rateId);
        setSelectedService(result.rates[0].service);
      }
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
    if (printBlockReason) {
      toast({ title: "Cannot print label", description: printBlockReason, variant: "destructive" });
      return;
    }

    const saleId = Number(selectedSaleId);
    const hasSale = Number.isFinite(saleId) && saleId > 0;

    setIsGenerating(true);
    try {
      const selectedRate = rates.find((r) => r.rateId === selectedRateId);
      const result = await generateShippingLabel({
        ...(hasSale ? { saleId } : {}),
        fromAddress: resolvedFrom,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
        service: selectedService || selectedRate?.service || "",
        rateId: selectedRateId,
        carrier: selectedRate?.carrier,
        estimatedDelivery:
          selectedRate?.deliveryDate ??
          selectedRate?.deliveryDays ??
          undefined,
      });
      if (hasSale) {
        await markShippingLabelCreated(saleId);
      }
      setLabelUrl(result.labelPdfUrl);
      setTrackingNumber(result.trackingNumber);
      setLabelFromAddress(result.fromAddress ?? resolvedFrom);
      setLabelToAddress(result.toAddress ?? toAddress);
      setLabelCarrier(result.carrier ?? selectedRate?.carrier ?? null);
      setLabelService(result.service ?? selectedService);
      setLabelEstimatedDelivery(
        result.estimatedDelivery ??
          selectedRate?.deliveryDate ??
          selectedRate?.deliveryDays ??
          null
      );
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

  const handleEmailLabel = async () => {
    if (!labelUrl || !trackingNumber) return;
    if (!emailTo.trim()) {
      toast({ title: "Email required", description: "Enter a recipient email.", variant: "destructive" });
      return;
    }
    setIsEmailing(true);
    try {
      const result = await emailShippingLabel({
        email: emailTo.trim(),
        labelUrl,
        trackingNumber,
      });
      toast({
        title: result.mock ? "Email logged (dev)" : "Email sent",
        description: result.message,
      });
    } catch (err) {
      toast({
        title: "Email failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsEmailing(false);
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
              Compare live carrier quotes or realistic estimates based on weight, distance, and service.
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
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="weight">Weight (lb)</Label>
              <Input id="weight" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="weightOz">Weight (oz)</Label>
              <Input id="weightOz" value={weightOz} onChange={(e) => setWeightOz(e.target.value)} />
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

        <div className="flex flex-wrap gap-3 items-center">
          <Button
            onClick={handleGetRates}
            disabled={isLoadingRates || !canGetRates}
            title={ratesBlockReason ?? undefined}
          >
            {isLoadingRates ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Get Rates
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !canPrintLabel}
            title={printBlockReason ?? undefined}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
            Print Label
          </Button>
          {ratesBlockReason ? (
            <p className="text-sm text-destructive">{ratesBlockReason}</p>
          ) : printBlockReason ? (
            <p className="text-sm text-muted-foreground">{printBlockReason}</p>
          ) : null}
        </div>

        {rates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available rates</CardTitle>
              {ratesMeta && (
                <p className="text-sm text-muted-foreground">
                  {ratesMeta.shipDateLabel ? `${ratesMeta.shipDateLabel} · ` : ""}
                  {ratesMeta.source === "live"
                    ? "Live carrier quotes"
                    : ratesMeta.source === "mixed"
                      ? "Live quotes + estimated rates for other carriers"
                      : "Estimated rates (add carrier API keys in .env for live quotes)"}
                  {ratesMeta.distanceMiles != null
                    ? ` · ~${ratesMeta.distanceMiles} mi`
                    : ""}
                  {ratesMeta.billableWeightLbs
                    ? ` · billable ${ratesMeta.billableWeightLbs.toFixed(2)} lb`
                    : ""}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Delivery time estimates are based on carrier data and may vary.
                {ratesMeta?.isInternational
                  ? " Customs clearance may add time."
                  : null}
              </p>
              {rates.map((rate) => (
                <label
                  key={rate.rateId}
                  className="flex items-center justify-between rounded-md border border-input px-3 py-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="radio"
                      name="service"
                      checked={selectedRateId === rate.rateId}
                      onChange={() => {
                        setSelectedRateId(rate.rateId);
                        setSelectedService(rate.service);
                      }}
                      className="shrink-0"
                    />
                    <span className="text-sm truncate">
                      {formatRateLabel(rate)}
                      {rate.source === "mock" ? (
                        <span className="text-xs text-muted-foreground ml-1">est.</span>
                      ) : null}
                    </span>
                  </span>
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
              <ShippingLabelSummary
                fromAddress={labelFromAddress ?? resolvedFrom}
                toAddress={labelToAddress ?? toAddress}
                carrier={labelCarrier}
                service={labelService}
                trackingNumber={trackingNumber}
                estimatedDelivery={labelEstimatedDelivery}
              />
              <div className="rounded-md border overflow-hidden bg-muted/30">
                <object
                  data={labelUrl}
                  type="application/pdf"
                  className="w-full h-[420px]"
                  aria-label="Shipping label preview"
                >
                  <p className="p-4 text-sm text-muted-foreground">
                    PDF preview unavailable in this browser.
                  </p>
                </object>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => printShippingLabelPdf(labelUrl)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Label
                </Button>
                <Button asChild>
                  <a href={labelUrl} target="_blank" rel="noopener noreferrer" download>
                    Download PDF
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Done
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                <Input
                  type="email"
                  placeholder="Email label to…"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="sm:flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleEmailLabel()}
                  disabled={isEmailing || !emailTo.trim()}
                >
                  {isEmailing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Email PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
