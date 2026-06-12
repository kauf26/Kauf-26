import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchShippingRates,
  generateShippingLabel,
  loadStoredShipFromAddress,
  markShippingLabelCreated,
  mergeShipFromAddress,
  DEFAULT_FROM_ADDRESS,
} from "@/lib/salesFetch";
import {
  downloadShippingLabelPdf,
  printShippingLabelPdfClient,
  shippingLabelContentFromApiResponse,
} from "@/lib/shippingLabelPdfClient";
import { fetchSaleLabelContext } from "@/lib/shippingLabelContext";

type Props = {
  saleId: number;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  /** Quick print: generate mock label with default package + first rate */
  mode?: "quick" | "wizard";
};

export function PrintShippingLabelButton({
  saleId,
  variant = "secondary",
  size = "sm",
  mode = "wizard",
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (mode === "wizard") {
    return (
      <Button variant={variant} size={size} asChild>
        <Link href={`/dashboard/shipping?saleId=${saleId}`}>Customize Label</Link>
      </Button>
    );
  }

  const handleQuickPrint = async () => {
    setLoading(true);
    try {
      const ctx = await fetchSaleLabelContext(saleId);
      const fromAddress = mergeShipFromAddress(
        loadStoredShipFromAddress(),
        ctx.fromAddress ?? DEFAULT_FROM_ADDRESS
      );
      const toAddress = ctx.toAddress;

      const ratesResult = await fetchShippingRates({
        fromAddress,
        toAddress,
        packageDetails: ctx.defaultPackage ?? {
          weightLbs: 1,
          weightOz: 0,
          lengthIn: 10,
          widthIn: 10,
          heightIn: 10,
        },
      });

      const rate = ratesResult.rates[0];
      if (!rate) {
        throw new Error("No shipping rates available");
      }

      const label = await generateShippingLabel({
        saleId,
        fromAddress,
        toAddress,
        packageDetails: {
          weightLbs: ctx.defaultPackage?.weightLbs ?? 1,
          lengthIn: ctx.defaultPackage?.lengthIn ?? 10,
          widthIn: ctx.defaultPackage?.widthIn ?? 10,
          heightIn: ctx.defaultPackage?.heightIn ?? 10,
        },
        service: rate.service,
        rateId: rate.rateId,
        carrier: rate.carrier,
        estimatedDelivery: rate.deliveryDate ?? rate.deliveryDays,
      });

      await markShippingLabelCreated(saleId);

      const content = shippingLabelContentFromApiResponse({
        fromAddress: label.fromAddress ?? fromAddress,
        toAddress: label.toAddress ?? toAddress,
        packageDetails: ctx.defaultPackage ?? { weightLbs: 1, lengthIn: 10, widthIn: 10, heightIn: 10 },
        carrier: label.carrier ?? rate.carrier,
        service: label.service ?? rate.service,
        trackingNumber: label.trackingNumber,
        estimatedDelivery: label.estimatedDelivery ?? rate.deliveryDate ?? rate.deliveryDays,
      });

      printShippingLabelPdfClient(content);
      toast({
        title: "Label ready",
        description: `Tracking ${label.trackingNumber}. Downloading PDF copy…`,
      });
      downloadShippingLabelPdf(content);
    } catch (error) {
      toast({
        title: "Label failed",
        description: error instanceof Error ? error.message : "Could not generate label",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} disabled={loading} onClick={() => void handleQuickPrint()}>
      {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />}
      Print Label
    </Button>
  );
}
