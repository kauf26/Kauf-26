import {
  formatAddressBlock,
  formatCarrierService,
} from "../../shared/shippingLabelTemplate";
import type { ShippingAddress } from "@/lib/salesFetch";

type Props = {
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  carrier?: string | null;
  service?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: string | null;
};

export function ShippingLabelSummary({
  fromAddress,
  toAddress,
  carrier,
  service,
  trackingNumber,
  estimatedDelivery,
}: Props) {
  const carrierLine =
    carrier || service ? formatCarrierService(carrier ?? "", service ?? "") : null;

  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm">
      <div className="rounded-md border border-border p-3 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Ship to
        </p>
        <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
          {formatAddressBlock(toAddress)}
        </pre>
      </div>
      <div className="rounded-md border border-border p-3 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          From / return
        </p>
        <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
          {formatAddressBlock(fromAddress)}
        </pre>
      </div>
      {(carrierLine || trackingNumber || estimatedDelivery) && (
        <div className="sm:col-span-2 space-y-1 text-muted-foreground">
          {carrierLine ? (
            <p>
              Service: <span className="text-foreground font-medium">{carrierLine}</span>
            </p>
          ) : null}
          {estimatedDelivery ? (
            <p>
              Est. delivery:{" "}
              <span className="text-foreground">{estimatedDelivery}</span>
            </p>
          ) : null}
          {trackingNumber ? (
            <p>
              Tracking:{" "}
              <span className="font-mono text-foreground">{trackingNumber}</span>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
