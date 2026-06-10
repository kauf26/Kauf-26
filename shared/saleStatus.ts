export type PaymentStatus = "pending" | "completed" | "failed";
export type FulfillmentStatus =
  | "not_shipped"
  | "shipped"
  | "delivered"
  | "accepted";

export type SaleStatusFilter =
  | "all"
  | "waiting_payment"
  | "shipped"
  | "delivered"
  | "accepted";

export type SaleTimelineFilter = "last45" | "yearly";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "completed",
  "failed",
];

export const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "not_shipped",
  "shipped",
  "delivered",
  "accepted",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Waiting for Payment",
  completed: "Payment Received",
  failed: "Payment Failed",
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  not_shipped: "Not Shipped",
  shipped: "Shipped",
  delivered: "Delivered",
  accepted: "Accepted",
};

export const SALE_STATUS_FILTER_LABELS: Record<SaleStatusFilter, string> = {
  all: "All",
  waiting_payment: "Waiting for Payment",
  shipped: "Shipped",
  delivered: "Delivered",
  accepted: "Accepted",
};

export type SaleWithStatus = {
  saleDate: string;
  paymentStatus?: PaymentStatus | string | null;
  payment_status?: PaymentStatus | string | null;
  fulfillmentStatus?: FulfillmentStatus | string | null;
  fulfillment_status?: FulfillmentStatus | string | null;
};

export function resolvePaymentStatus(sale: SaleWithStatus): PaymentStatus {
  const raw = sale.paymentStatus ?? sale.payment_status ?? "pending";
  if (raw === "completed" || raw === "failed") return raw;
  return "pending";
}

export function resolveFulfillmentStatus(sale: SaleWithStatus): FulfillmentStatus {
  const raw = sale.fulfillmentStatus ?? sale.fulfillment_status ?? "not_shipped";
  if (raw === "shipped" || raw === "delivered" || raw === "accepted") return raw;
  return "not_shipped";
}

export function filterSalesByTimeline<T extends SaleWithStatus>(
  sales: T[],
  timeline: SaleTimelineFilter,
  now = new Date()
): T[] {
  if (timeline === "yearly") {
    const year = now.getFullYear();
    return sales.filter((sale) => {
      const d = new Date(sale.saleDate);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    });
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 45);
  return sales.filter((sale) => {
    const d = new Date(sale.saleDate);
    return !Number.isNaN(d.getTime()) && d >= cutoff;
  });
}

export function filterSalesByStatus<T extends SaleWithStatus>(
  sales: T[],
  statusFilter: SaleStatusFilter
): T[] {
  if (statusFilter === "all") return sales;

  return sales.filter((sale) => {
    const payment = resolvePaymentStatus(sale);
    const fulfillment = resolveFulfillmentStatus(sale);
    switch (statusFilter) {
      case "waiting_payment":
        return payment === "pending";
      case "shipped":
        return fulfillment === "shipped";
      case "delivered":
        return fulfillment === "delivered";
      case "accepted":
        return fulfillment === "accepted";
      default:
        return true;
    }
  });
}

export function filterSalesList<T extends SaleWithStatus>(
  sales: T[],
  timeline: SaleTimelineFilter,
  statusFilter: SaleStatusFilter,
  now = new Date()
): T[] {
  return filterSalesByStatus(
    filterSalesByTimeline(sales, timeline, now),
    statusFilter
  );
}
