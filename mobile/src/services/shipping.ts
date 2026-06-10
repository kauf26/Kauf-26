import { API_BASE_URL } from './config';

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
  carrier: string;
  service: string;
  price: number;
  etaDays: number;
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

export async function fetchShippingRates(weightLbs: number): Promise<ShippingRate[]> {
  const res = await fetch(`${API_BASE_URL}/api/shipping/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ weightLbs }),
  });
  const data = (await res.json()) as { rates?: ShippingRate[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch rates');
  return data.rates ?? [];
}

export async function generateShippingLabel(input: {
  saleId: number;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packageDetails: { weightLbs: number; lengthIn: number; widthIn: number; heightIn: number };
  service: string;
}): Promise<{ labelPdfUrl: string; trackingNumber: string }> {
  const res = await fetch(`${API_BASE_URL}/api/shipping/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    labelPdfUrl?: string;
    trackingNumber?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate label');
  return {
    labelPdfUrl: data.labelPdfUrl ?? '',
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
