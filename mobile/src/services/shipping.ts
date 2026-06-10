import { API_BASE_URL } from './config';
import type {
  FulfillmentStatus,
  PaymentStatus,
} from '../../../shared/saleStatus';
import {
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
} from '../../../shared/shippingValidation';

export {
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
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
}): Promise<{ labelPdfUrl: string; labelUrl: string; trackingNumber: string }> {
  const res = await fetch(`${API_BASE_URL}/api/shipping/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    labelPdfUrl?: string;
    labelUrl?: string;
    trackingNumber?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate label');
  const url = data.labelPdfUrl ?? data.labelUrl ?? '';
  return {
    labelPdfUrl: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
    labelUrl: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
    trackingNumber: data.trackingNumber ?? '1Z9999999999',
  };
}

export function parseBuyerAddress(buyerInfo?: string | null): ShippingAddress {
  if (!buyerInfo?.trim()) {
    return { name: 'Buyer', line1: '', city: '', state: '', postalCode: '', country: 'US' };
  }
  try {
    return JSON.parse(buyerInfo) as ShippingAddress;
  } catch {
    return { name: buyerInfo, line1: '', city: '', state: '', postalCode: '', country: 'US' };
  }
}

export const DEFAULT_FROM_ADDRESS: ShippingAddress = {
  name: 'KAUF26 Seller',
  line1: '123 Warehouse Rd',
  city: 'Los Angeles',
  state: 'CA',
  postalCode: '90001',
  country: 'US',
};
