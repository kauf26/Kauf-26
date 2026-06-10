import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSales } from "@/hooks/use-sales";
import {
  SALES_QUERY_KEY,
  updateSaleStatus,
  type DashboardSale,
} from "@/lib/salesFetch";
import {
  filterSalesList,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  resolveFulfillmentStatus,
  resolvePaymentStatus,
  SALE_STATUS_FILTER_LABELS,
  type FulfillmentStatus,
  type SaleStatusFilter,
  type SaleTimelineFilter,
} from "../../shared/saleStatus";
import {
  Loader2,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Package,
  Truck,
} from "lucide-react";

function paymentBadgeVariant(
  status: ReturnType<typeof resolvePaymentStatus>
): "default" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function fulfillmentBadgeVariant(
  status: ReturnType<typeof resolveFulfillmentStatus>
): "default" | "secondary" | "outline" {
  if (status === "accepted") return "default";
  if (status === "delivered" || status === "shipped") return "secondary";
  return "outline";
}

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeline, setTimeline] = useState<SaleTimelineFilter>("last45");
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>("all");

  const { data: sales = [], isLoading, isFetching } = useSales();

  const filteredSales = useMemo(
    () => filterSalesList(sales, timeline, statusFilter),
    [sales, timeline, statusFilter]
  );

  const statusMutation = useMutation({
    mutationFn: ({
      saleId,
      patch,
    }: {
      saleId: number;
      patch: Parameters<typeof updateSaleStatus>[1];
    }) => updateSaleStatus(saleId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["sales", "poll"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const payFeeMutation = useMutation({
    mutationFn: async (saleId: number) => {
      const res = await fetch(`/api/sales/${saleId}/pay-fee`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create payment session");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: "Payment Error",
        description: "Could not start payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + parseFloat(sale.saleAmount),
    0
  );
  const totalFees = filteredSales.reduce(
    (sum, sale) => sum + parseFloat(sale.ourFee),
    0
  );
  const netProceeds = totalRevenue - totalFees;

  const updateStatus = (
    saleId: number,
    patch: Parameters<typeof updateSaleStatus>[1]
  ) => {
    statusMutation.mutate({ saleId, patch });
  };

  if (isLoading || (isFetching && sales.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Sales & Earnings</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Track sales, payments, and fulfillment — 2% service fee applies to each item sold
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="inline-flex rounded-lg border border-input p-1 bg-muted/30">
            <Button
              type="button"
              size="sm"
              variant={timeline === "last45" ? "default" : "ghost"}
              onClick={() => setTimeline("last45")}
            >
              Last 45 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timeline === "yearly" ? "default" : "ghost"}
              onClick={() => setTimeline("yearly")}
            >
              Yearly ({new Date().getFullYear()})
            </Button>
          </div>

          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SaleStatusFilter)}
          >
            {(Object.keys(SALE_STATUS_FILTER_LABELS) as SaleStatusFilter[]).map(
              (key) => (
                <option key={key} value={key}>
                  {SALE_STATUS_FILTER_LABELS[key]}
                </option>
              )
            )}
          </select>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">
                ${totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredSales.length} sale{filteredSales.length === 1 ? "" : "s"} in view
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Service Fees (2%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500" data-testid="text-total-fees">
                -${totalFees.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Proceeds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500" data-testid="text-net-proceeds">
                ${netProceeds.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredSales.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Sales in This View</h3>
              <p className="text-muted-foreground">
                {sales.length === 0
                  ? "Sales will appear here once products are purchased"
                  : "Try a different timeline or status filter"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSales.map((sale) => (
              <SaleCard
                key={sale.id}
                sale={sale}
                isUpdating={statusMutation.isPending}
                onPayFee={() => payFeeMutation.mutate(sale.id)}
                isPayingFee={payFeeMutation.isPending}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaleCard({
  sale,
  isUpdating,
  onPayFee,
  isPayingFee,
  onUpdateStatus,
}: {
  sale: DashboardSale;
  isUpdating: boolean;
  onPayFee: () => void;
  isPayingFee: boolean;
  onUpdateStatus: (
    saleId: number,
    patch: Parameters<typeof updateSaleStatus>[1]
  ) => void;
}) {
  const payment = resolvePaymentStatus(sale);
  const fulfillment = resolveFulfillmentStatus(sale);
  const saleAmount = parseFloat(sale.saleAmount);
  const ourFee = parseFloat(sale.ourFee);
  const platformFee = parseFloat(sale.platformFee ?? "0");
  const netAmount = saleAmount - ourFee - platformFee;

  return (
    <Card data-testid={`card-sale-${sale.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">
              {sale.productTitle ?? `Sale #${sale.id}`}
            </CardTitle>
            <CardDescription>
              {sale.marketplace ? `${sale.marketplace} · ` : ""}
              {new Date(sale.saleDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge variant={paymentBadgeVariant(payment)}>
                {PAYMENT_STATUS_LABELS[payment]}
              </Badge>
              <Badge variant={fulfillmentBadgeVariant(fulfillment)}>
                {FULFILLMENT_STATUS_LABELS[fulfillment]}
              </Badge>
            </div>
            {sale.feePaid ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Fee Paid
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={onPayFee}
                disabled={isPayingFee}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Pay 2% Fee (${ourFee.toFixed(2)})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Gross Sale</div>
            <div className="text-lg font-semibold mt-1">
              {sale.saleCurrency} {saleAmount.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Platform Fee</div>
            <div className="text-lg font-semibold mt-1 text-orange-400">
              -${platformFee.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Net Proceeds
            </div>
            <div className="text-lg font-semibold mt-1 text-green-500">
              ${netAmount.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Shipping Label</div>
            <div className="text-sm font-medium mt-1">
              {sale.shippingLabelGenerated ? (
                <span className="text-green-500">Generated</span>
              ) : (
                <span className="text-muted-foreground">Not yet</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {payment !== "completed" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() =>
                onUpdateStatus(sale.id, { payment_status: "completed" })
              }
            >
              Mark Payment Received
            </Button>
          )}
          {fulfillment === "not_shipped" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() =>
                onUpdateStatus(sale.id, {
                  fulfillment_status: "shipped" satisfies FulfillmentStatus,
                })
              }
            >
              <Package className="w-3 h-3 mr-1" />
              Mark Shipped
            </Button>
          )}
          {fulfillment === "shipped" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() =>
                onUpdateStatus(sale.id, { fulfillment_status: "delivered" })
              }
            >
              <Truck className="w-3 h-3 mr-1" />
              Mark Delivered
            </Button>
          )}
          {fulfillment !== "accepted" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() =>
                onUpdateStatus(sale.id, { fulfillment_status: "accepted" })
              }
            >
              Mark Accepted
            </Button>
          )}
        </div>

        {(sale.shippedAt || sale.deliveredAt || sale.acceptedAt) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {sale.shippedAt && (
              <p>Shipped: {new Date(sale.shippedAt).toLocaleString()}</p>
            )}
            {sale.deliveredAt && (
              <p>Delivered: {new Date(sale.deliveredAt).toLocaleString()}</p>
            )}
            {sale.acceptedAt && (
              <p>Accepted: {new Date(sale.acceptedAt).toLocaleString()}</p>
            )}
          </div>
        )}

        {sale.buyerInfo && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-1">Buyer Information</div>
            <div className="text-sm">{sale.buyerInfo}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
