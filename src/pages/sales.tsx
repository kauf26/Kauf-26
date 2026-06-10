import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSales } from "@/hooks/use-sales";
import { Loader2, DollarSign, CheckCircle2, TrendingUp, CreditCard } from "lucide-react";

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

  const { data: sales = [], isLoading, isFetching } = useSales();

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

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + parseFloat(sale.saleAmount),
    0
  );

  const totalFees = sales.reduce((sum, sale) => sum + parseFloat(sale.ourFee), 0);
  const netProceeds = totalRevenue - totalFees;

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
            Track your sales — a 2% service fee applies to each item that sells, not to items you post
          </p>
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
                From {sales.length} sales
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
              <p className="text-xs text-muted-foreground mt-1">2% on each item sold</p>
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
              <p className="text-xs text-muted-foreground mt-1">Your earnings</p>
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
            {sales.map((sale) => {
              const saleAmount = parseFloat(sale.saleAmount);
              const ourFee = parseFloat(sale.ourFee);
              const platformFee = parseFloat(sale.platformFee);
              const netAmount = saleAmount - ourFee - platformFee;

              return (
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
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-900/60 to-purple-700/40 border border-purple-500/40 rounded-full px-2.5 py-1" data-testid={`badge-sold-kauf-${sale.id}`}>
                          <img src="/kauf-logo.jpeg" alt="KAUF" className="w-4 h-4 rounded-sm object-cover" />
                          <span className="text-xs font-semibold text-purple-200">Sold with KAUF</span>
                        </div>
                      {sale.feePaid ? (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1 bg-green-600"
                          data-testid={`badge-fee-${sale.id}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {parseFloat(sale.ourFee) === 0 ? "Trial — No Fee" : "Fee Paid"}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex items-center gap-1"
                          onClick={() => payFeeMutation.mutate(sale.id)}
                          disabled={payFeeMutation.isPending || isFetching}
                          data-testid={`button-pay-fee-${sale.id}`}
                        >
                          <CreditCard className="w-3 h-3" />
                          Pay 2% Fee (${parseFloat(sale.ourFee).toFixed(2)})
                        </Button>
                      )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                        <div className="text-sm text-muted-foreground">Service Fee (2%)</div>
                        <div className="text-lg font-semibold mt-1 text-orange-400">
                          -${ourFee.toFixed(2)}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
