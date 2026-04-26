import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  converted: number;
  rate: number;
}

interface ShippingLabel {
  id: string;
  trackingNumber: string;
  shipTo: any;
  shipFrom: any;
  weight: string;
  dimensions: string;
  estimatedCost: number;
  billableWeight: number;
  createdAt: string;
}

export default function Tools() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

  const [shipTo, setShipTo] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [label, setLabel] = useState<ShippingLabel | null>(null);

  const currencies = ["USD", "EUR", "GBP", "JPY", "MXN", "BRL", "AUD", "CAD"];

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/convert-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          from: fromCurrency,
          to: toCurrency,
        }),
      });
      if (!res.ok) throw new Error("Conversion failed");
      return res.json();
    },
    onSuccess: (data: ConversionResult) => {
      setConversionResult(data);
    },
    onError: () => {
      toast({
        title: "Conversion Failed",
        description: "Could not convert currency. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateLabelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shipping-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: null,
          shipTo: JSON.parse(shipTo),
          shipFrom: JSON.parse(shipFrom),
          weight,
          dimensions,
        }),
      });
      if (!res.ok) throw new Error("Label generation failed");
      return res.json();
    },
    onSuccess: (data: ShippingLabel) => {
      setLabel(data);
      toast({
        title: "Label Generated",
        description: `Tracking: ${data.trackingNumber}`,
      });
    },
    onError: () => {
      toast({
        title: "Label Generation Failed",
        description: "Could not generate shipping label. Check JSON format.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Tools</h1>
          <p className="text-muted-foreground text-lg">
            Utilities for currency conversion and shipping labels
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                <CardTitle>Currency Converter</CardTitle>
              </div>
              <CardDescription>
                Convert between different currencies for international sales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  className="mt-2"
                  data-testid="input-amount"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from">From</Label>
                  <select
                    id="from"
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-from"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="to">To</Label>
                  <select
                    id="to"
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-to"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                onClick={() => convertMutation.mutate()}
                disabled={!amount || convertMutation.isPending}
                className="w-full"
                data-testid="button-convert"
              >
                {convertMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  "Convert"
                )}
              </Button>

              {conversionResult && (
                <div className="p-4 bg-accent/50 rounded-lg border" data-testid="conversion-result">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-2">Result</div>
                    <div className="text-3xl font-bold mb-1">
                      {conversionResult.converted.toFixed(2)} {conversionResult.to}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rate: 1 {conversionResult.from} = {conversionResult.rate.toFixed(4)}{" "}
                      {conversionResult.to}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <CardTitle>Shipping Label Generator</CardTitle>
              </div>
              <CardDescription>
                Generate shipping labels for sold products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ship-from">Ship From (JSON)</Label>
                <Textarea
                  id="ship-from"
                  value={shipFrom}
                  onChange={(e) => setShipFrom(e.target.value)}
                  placeholder='{"name": "John Doe", "address": "123 Main St", "city": "New York", "zip": "10001"}'
                  rows={3}
                  className="mt-2 font-mono text-xs"
                  data-testid="textarea-ship-from"
                />
              </div>

              <div>
                <Label htmlFor="ship-to">Ship To (JSON)</Label>
                <Textarea
                  id="ship-to"
                  value={shipTo}
                  onChange={(e) => setShipTo(e.target.value)}
                  placeholder='{"name": "Jane Smith", "address": "456 Oak Ave", "city": "Los Angeles", "zip": "90001"}'
                  rows={3}
                  className="mt-2 font-mono text-xs"
                  data-testid="textarea-ship-to"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input
                    id="weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="2.5"
                    className="mt-2"
                    data-testid="input-weight"
                  />
                </div>
                <div>
                  <Label htmlFor="dimensions">Dimensions (in)</Label>
                  <Input
                    id="dimensions"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder="10x8x4"
                    className="mt-2"
                    data-testid="input-dimensions"
                  />
                </div>
              </div>

              <Button
                onClick={() => generateLabelMutation.mutate()}
                disabled={
                  !shipTo || !shipFrom || !weight || !dimensions || generateLabelMutation.isPending
                }
                className="w-full"
                data-testid="button-generate-label"
              >
                {generateLabelMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Label"
                )}
              </Button>

              {label && (
                <div className="p-4 bg-accent/50 rounded-lg border space-y-2" data-testid="label-result">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Label ID:</span>
                    <Badge>{label.id}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tracking:</span>
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {label.trackingNumber}
                    </code>
                  </div>
                  <div className="flex items-center justify-between bg-green-500/10 p-2 rounded-md border border-green-500/20">
                    <span className="text-sm font-medium text-green-600">Estimated Shipping Cost:</span>
                    <span className="text-lg font-bold text-green-600">${label.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Billable Weight:</span>
                    <span>{label.billableWeight} lbs</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Generated: {new Date(label.createdAt).toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
