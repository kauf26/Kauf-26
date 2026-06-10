import { fetchJsonOrDefault } from "./stableFetch";

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
};

export const SALES_QUERY_KEY = ["sales"] as const;

export function fetchSales(): Promise<DashboardSale[]> {
  return fetchJsonOrDefault(SALES_QUERY_KEY.join("/"), "/api/sales", []);
}
