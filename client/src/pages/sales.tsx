import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, CheckCircle2, Clock, CreditCard } from "lucide-react";

interface Sale {
  id: number;
  listingId: number;
  saleAmount: string;
  saleCurrency: string;
  platformFee: string;
  ourFee: string;
  feePaid: boolean;
  saleDate: string;
  buyerInfo: string | null;
  shippingLabelGenerated: boolean;
}

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const payFeeMutation = useMutation({
    mutationFn: async (saleId: number) => {
      const res = await fetch(`/api/sales/${saleId}/pay-fee`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create payment session");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Payment Error",
        description: "Could not start payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const saleId = params.get("saleId");

    if (payment === "success" && saleId) {
      fetch(`/api/sales/${saleId}/mark-paid`, { method: "POST" })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["sales"] });
          toast({
            title: "Payment Successful!",
            description: "Your service fee has been paid. Thank you!",
          });
        });
      window.history.replaceState({}, "", "/sales");
    } else if (payment === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "You can pay the fee anytime from this page.",
      });
      window.history.replaceState({}, "", "/sales");
    }
  }, [queryClient, toast]);

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + parseFloat(sale.saleAmount),
    0
  );

  const totalFees = sales.reduce((sum, sale) => sum + parseFloat(sale.ourFee), 0);

  const paidFees = sales
    .filter((s) => s.feePaid)
    .reduce((sum, sale) => sum + parseFloat(sale.ourFee), 0);

  const unpaidFees = totalFees - paidFees;

  if (isLoading) {
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
            <h1 className="text-4xl font-bold tracking-tight">Sales & Fees</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Track revenue and manage your 1% service fees
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">
                ${totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {sales.length} sales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unpaid Fees (1%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-unpaid-fees">
                ${unpaidFees.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pending payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500" data-testid="text-paid-fees">
                ${paidFees.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Settled</p>
            </CardContent>
          </Card>
        </div>

        {sales.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Sales Yet</h3>
              <p className="text-muted-foreground">
                Sales will appear here once products are purchased
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <Card key={sale.id} data-testid={`card-sale-${sale.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Sale #{sale.id}
                      </CardTitle>
                      <CardDescription>
                        {new Date(sale.saleDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {!sale.feePaid && (
                        <Button
                          size="sm"
                          onClick={() => payFeeMutation.mutate(sale.id)}
                          disabled={payFeeMutation.isPending}
                          data-testid={`button-pay-fee-${sale.id}`}
                        >
                          {payFeeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Pay ${parseFloat(sale.ourFee).toFixed(2)}
                            </>
                          )}
                        </Button>
                      )}
                      <Badge
                        variant={sale.feePaid ? "default" : "secondary"}
                        className="flex items-center gap-1"
                        data-testid={`badge-fee-${sale.id}`}
                      >
                        {sale.feePaid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Fee Paid
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            Fee Pending
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Sale Amount</div>
                      <div className="text-lg font-semibold mt-1">
                        {sale.saleCurrency} {parseFloat(sale.saleAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Platform Fee</div>
                      <div className="text-lg font-semibold mt-1">
                        ${parseFloat(sale.platformFee).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Our Fee (1%)</div>
                      <div className="text-lg font-semibold mt-1 text-primary">
                        ${parseFloat(sale.ourFee).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Shipping Label</div>
                      <div className="text-lg font-semibold mt-1">
                        {sale.shippingLabelGenerated ? (
                          <span className="text-green-500">Generated</span>
                        ) : (
                          <span className="text-muted-foreground">Not yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {sale.buyerInfo && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">
                        Buyer Information
                      </div>
                      <div className="text-sm">{sale.buyerInfo}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
