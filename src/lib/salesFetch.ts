import { fetchLiveEndpoint, fetchOptionalEndpoint, waitForBackendReady } from "./stableFetch";
import type {
  FulfillmentStatus,
  PaymentStatus,
} from "../../shared/saleStatus";
import { mergeShipFromAddress } from "../../shared/shippingValidation";
import { SHIP_FROM_STORAGE_KEY, type StoredShipFromAddress } from "../../shared/shippingStorage";
import { parseBuyerAddress as parseBuyerAddressShared } from "../../shared/shippingAddresses";

export {
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
  getShippingToPackageBlockReason,
  isShippingAddressComplete,
  isShippingWeightValid,
  mergeShipFromAddress,
} from "../../shared/shippingValidation";

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
  paymentStatus?: PaymentStatus;
  payment_status?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  fulfillment_status?: FulfillmentStatus;
  shippedAt?: string | null;
  shipped_at?: string | null;
  deliveredAt?: string | null;
  delivered_at?: string | null;
  acceptedAt?: string | null;
  accepted_at?: string | null;
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

export async function updateSaleStatus(
  saleId: number,
  patch: {
    payment_status?: PaymentStatus;
    fulfillment_status?: FulfillmentStatus;
  }
): Promise<DashboardSale> {
  const res = await fetch(`/api/sales/${saleId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as DashboardSale & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to update sale status");
  return data;
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
  await waitForBackendReady();
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
  saleId?: number;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packageDetails: { weightLbs: number; lengthIn: number; widthIn: number; heightIn: number };
  service: string;
  rateId?: string;
  carrier?: string;
  estimatedDelivery?: string;
  deliveryDate?: string;
}): Promise<{
  labelPdfUrl: string;
  labelUrl: string;
  trackingNumber: string;
  fromAddress?: ShippingAddress;
  toAddress?: ShippingAddress;
  carrier?: string | null;
  service?: string;
  estimatedDelivery?: string | null;
}> {
  await waitForBackendReady();
  const res = await fetch("/api/shipping/label", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    labelPdfUrl?: string;
    labelUrl?: string;
    trackingNumber?: string;
    fromAddress?: ShippingAddress;
    toAddress?: ShippingAddress;
    carrier?: string | null;
    service?: string;
    estimatedDelivery?: string | null;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to generate label");
  const url = data.labelPdfUrl ?? data.labelUrl ?? "";
  return {
    labelPdfUrl: url,
    labelUrl: url,
    trackingNumber: data.trackingNumber ?? "1Z9999999999",
    fromAddress: data.fromAddress,
    toAddress: data.toAddress,
    carrier: data.carrier,
    service: data.service,
    estimatedDelivery: data.estimatedDelivery,
  };
}

export function parseBuyerAddress(buyerInfo: string | null | undefined): ShippingAddress {
  return parseBuyerAddressShared(buyerInfo);
}

export const DEFAULT_FROM_ADDRESS: ShippingAddress = {
  name: "KAUF26 Seller",
  line1: "123 Warehouse Rd",
  city: "Los Angeles",
  state: "CA",
  postalCode: "90001",
  country: "US",
};

export function loadStoredShipFromAddress(): ShippingAddress {
  if (typeof window === "undefined") return DEFAULT_FROM_ADDRESS;
  try {
    const raw = localStorage.getItem(SHIP_FROM_STORAGE_KEY);
    if (!raw) return DEFAULT_FROM_ADDRESS;
    const parsed = JSON.parse(raw) as StoredShipFromAddress;
    return mergeShipFromAddress(parsed, DEFAULT_FROM_ADDRESS);
  } catch {
    return DEFAULT_FROM_ADDRESS;
  }
}

export function saveStoredShipFromAddress(address: ShippingAddress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHIP_FROM_STORAGE_KEY, JSON.stringify(address));
  } catch {
    /* ignore quota errors */
  }
}

export async function emailShippingLabel(input: {
  email: string;
  labelUrl: string;
  trackingNumber: string;
}): Promise<{ mock?: boolean; message: string }> {
  await waitForBackendReady();
  const res = await fetch("/api/shipping/label/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { message?: string; mock?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to send email");
  return { mock: data.mock, message: data.message ?? "Email sent." };
}
