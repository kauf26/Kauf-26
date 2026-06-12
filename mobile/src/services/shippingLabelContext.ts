import { API_BASE_URL } from './config';
import type { ShippingAddress } from '../../../shared/shippingAddresses';
import type { LabelPackageDetails } from '../../../shared/shippingLabelTemplate';

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
  const res = await fetch(`${API_BASE_URL}/api/shipping/sales/${saleId}/label-context`, {
    headers: { Accept: 'application/json' },
  });
  const data = (await res.json()) as SaleLabelContext & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to load order shipping info');
  return data;
}
