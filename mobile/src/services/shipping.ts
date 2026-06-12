import { API_BASE_URL } from './config';
import * as SecureStore from 'expo-secure-store';
import type {
  FulfillmentStatus,
  PaymentStatus,
} from '../../../shared/saleStatus';
import {
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
  getShippingToPackageBlockReason,
  mergeShipFromAddress,
} from '../../../shared/shippingValidation';
import { SHIP_FROM_STORAGE_KEY } from '../../../shared/shippingStorage';
import { parseBuyerAddress as parseBuyerAddressShared } from '../../../shared/shippingAddresses';

export {
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
  getShippingToPackageBlockReason,
  mergeShipFromAddress,
} from '../../../shared/shippingValidation';

export type MobileSale = {
  id: number;
  listingId?: number;
  saleAmount: string;
  saleCurrency: string;
  ourFee: string;
  feePaid: boolean;
  saleDate: string;
  buyerInfo?: string | null;
  shippingLabelCreated?: boolean;
  shipping_label_created?: boolean;
  shippingLabelGenerated?: boolean;
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
};

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
  etaDays?: number;
  deliveryDays?: string;
  deliveryDate?: string;
  source?: 'live' | 'mock';
};

export type ShippingRatesResponse = {
  rates: ShippingRate[];
  source: 'live' | 'mixed' | 'mock';
  distanceMiles: number | null;
  isInternational: boolean;
  billableWeightLbs: number;
  currency: string;
  shipDate?: string;
  shipDateLabel?: string;
};

export function formatRateLabel(rate: ShippingRate): string {
  const price = `$${rate.price.toFixed(2)}`;
  const transit =
    rate.deliveryDays ??
    (rate.etaDays != null
      ? rate.etaDays === 1
        ? '1 business day'
        : `${rate.etaDays} business days`
      : null);
  const transitPart = transit ? ` (${transit})` : '';
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

export function isShippingLabelPending(sale: MobileSale): boolean {
  return !(sale.shippingLabelCreated === true || sale.shipping_label_created === true);
}

export async function fetchSalesLive(): Promise<MobileSale[]> {
  const res = await fetch(`${API_BASE_URL}/api/sales`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.sales ?? [];
}

export async function updateSaleStatus(
  saleId: number,
  patch: {
    payment_status?: PaymentStatus;
    fulfillment_status?: FulfillmentStatus;
  }
): Promise<MobileSale> {
  const res = await fetch(`${API_BASE_URL}/api/sales/${saleId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as MobileSale & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to update sale status');
  return data;
}

export async function markShippingLabelCreated(saleId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/sales/${saleId}/shipping-label-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ created: true }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to update shipping status');
  }
}

export async function fetchShippingRates(
  input: ShippingRateRequest
): Promise<ShippingRatesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/shipping/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as ShippingRatesResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch rates');
  return { ...data, rates: data.rates ?? [] };
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
  const res = await fetch(`${API_BASE_URL}/api/shipping/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate label');
  const url = data.labelPdfUrl ?? data.labelUrl ?? '';
  return {
    labelPdfUrl: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
    labelUrl: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
    trackingNumber: data.trackingNumber ?? '1Z9999999999',
    fromAddress: data.fromAddress,
    toAddress: data.toAddress,
    carrier: data.carrier,
    service: data.service,
    estimatedDelivery: data.estimatedDelivery,
  };
}

export function parseBuyerAddress(buyerInfo?: string | null): ShippingAddress {
  return parseBuyerAddressShared(buyerInfo);
}

export const DEFAULT_FROM_ADDRESS: ShippingAddress = {
  name: 'KAUF26 Seller',
  line1: '123 Warehouse Rd',
  city: 'Los Angeles',
  state: 'CA',
  postalCode: '90001',
  country: 'US',
};

export async function loadStoredShipFromAddress(): Promise<ShippingAddress> {
  try {
    const raw = await SecureStore.getItemAsync(SHIP_FROM_STORAGE_KEY);
    if (!raw) return DEFAULT_FROM_ADDRESS;
    const parsed = JSON.parse(raw) as ShippingAddress;
    return mergeShipFromAddress(parsed, DEFAULT_FROM_ADDRESS);
  } catch {
    return DEFAULT_FROM_ADDRESS;
  }
}

export async function saveStoredShipFromAddress(address: ShippingAddress): Promise<void> {
  try {
    await SecureStore.setItemAsync(SHIP_FROM_STORAGE_KEY, JSON.stringify(address));
  } catch {
    /* ignore storage errors */
  }
}

export async function emailShippingLabel(input: {
  email: string;
  labelUrl: string;
  trackingNumber: string;
}): Promise<{ mock?: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/shipping/label/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { message?: string; mock?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to send email');
  return { mock: data.mock, message: data.message ?? 'Email sent.' };
}
