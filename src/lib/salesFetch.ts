import { fetchLiveEndpoint, fetchOptionalEndpoint } from "./stableFetch";

export type DashboardSale = {
  id: number;
  saleAmount: string;
  saleCurrency: string;
  ourFee: string;
  feePaid: boolean;
  saleDate: string;
  listingId?: number;
  platformFee?: string;
  buyerInfo?: string | null;
  shippingLabelGenerated?: boolean;
  shippingLabelCreated?: boolean;
  shipping_label_created?: boolean;
  productTitle?: string;
  marketplace?: string;
  productId?: number;
};

export const SALES_QUERY_KEY = ["sales"] as const;
export const SALES_POLL_QUERY_KEY = ["sales", "poll"] as const;

export function isShippingLabelPending(sale: DashboardSale): boolean {
  return !(
    sale.shippingLabelCreated === true ||
    sale.shipping_label_created === true ||
    sale.shippingLabelGenerated === true
  );
}

export function fetchSales(): Promise<DashboardSale[]> {
  return fetchOptionalEndpoint(SALES_QUERY_KEY.join("/"), "/api/sales", []);
}

/** Live sales fetch for sold-item polling (30s interval, in-flight dedupe only). */
export function fetchSalesLive(): Promise<DashboardSale[]> {
  return fetchLiveEndpoint(
    `${SALES_POLL_QUERY_KEY.join("/")}:live`,
    "/api/sales",
    []
  );
}

export async function markShippingLabelCreated(saleId: number): Promise<void> {
  const res = await fetch(`/api/sales/${saleId}/shipping-label-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ created: true }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `Failed to update label status (${res.status})`);
  }
}

export type ShippingAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type ShippingRate = {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  /** @deprecated Prefer deliveryDays */
  etaDays?: number;
  deliveryDays?: string;
  deliveryDate?: string;
  source?: "live" | "mock";
};

export type ShippingRatesResponse = {
  rates: ShippingRate[];
  source: "live" | "mixed" | "mock";
  distanceMiles: number | null;
  isInternational: boolean;
  billableWeightLbs: number;
  currency: string;
  shipDate?: string;
  shipDateLabel?: string;
};

/** Human-readable rate line with graceful fallback when deliveryDays is missing. */
export function formatRateLabel(rate: ShippingRate): string {
  const price =
    rate.currency === "USD"
      ? `$${rate.price.toFixed(2)}`
      : `${rate.currency} ${rate.price.toFixed(2)}`;
  const transit =
    rate.deliveryDays ??
    (rate.etaDays != null
      ? rate.etaDays === 1
        ? "1 business day"
        : `${rate.etaDays} business days`
      : null);
  const transitPart = transit ? ` (${transit})` : "";
  return `${rate.carrier} ${rate.service} — ${price}${transitPart}`;
}

export type ShippingRateRequest = {
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packageDetails: {
    weightLbs: number;
    weightOz?: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
  };
};

export async function fetchShippingRates(
  input: ShippingRateRequest
): Promise<ShippingRatesResponse> {
  const res = await fetch("/api/shipping/rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as ShippingRatesResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch rates");
  return {
    ...data,
    rates: data.rates ?? [],
  };
}

export async function generateShippingLabel(input: {
  saleId: number;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packageDetails: { weightLbs: number; lengthIn: number; widthIn: number; heightIn: number };
  service: string;
}): Promise<{ labelPdfUrl: string; trackingNumber: string }> {
  const res = await fetch("/api/shipping/label", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    labelPdfUrl?: string;
    trackingNumber?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to generate label");
  return {
    labelPdfUrl: data.labelPdfUrl ?? "",
    trackingNumber: data.trackingNumber ?? "1Z9999999999",
  };
}

export function parseBuyerAddress(buyerInfo: string | null | undefined): ShippingAddress {
  if (!buyerInfo?.trim()) {
    return { name: "Buyer", line1: "", city: "", state: "", postalCode: "", country: "US" };
  }
  try {
    const parsed = JSON.parse(buyerInfo) as ShippingAddress;
    return parsed;
  } catch {
    return { name: buyerInfo, line1: "", city: "", state: "", postalCode: "", country: "US" };
  }
}

export const DEFAULT_FROM_ADDRESS: ShippingAddress = {
  name: "KAUF26 Seller",
  line1: "123 Warehouse Rd",
  city: "Los Angeles",
  state: "CA",
  postalCode: "90001",
  country: "US",
};
