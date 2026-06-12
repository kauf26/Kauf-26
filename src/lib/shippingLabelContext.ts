import type { ShippingAddress } from "../../shared/shippingAddresses";
import type { LabelPackageDetails } from "../../shared/shippingLabelTemplate";
import { waitForBackendReady } from "./stableFetch";

export type SaleLabelContext = {
  saleId: number;
  productTitle?: string | null;
  marketplace?: string | null;
  buyerInfo?: string | null;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  defaultPackage: LabelPackageDetails & { weightOz?: number };
  existingLabel?: {
    trackingNumber: string;
    labelPdfUrl: string;
    service: string;
  } | null;
};

export async function fetchSaleLabelContext(saleId: number): Promise<SaleLabelContext> {
  await waitForBackendReady();
  const res = await fetch(`/api/shipping/sales/${saleId}/label-context`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  const data = (await res.json()) as SaleLabelContext & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load order shipping info");
  return data;
}
