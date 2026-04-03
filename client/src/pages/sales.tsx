import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, CheckCircle2, TrendingUp, CreditCard, Clock, Zap, Star } from "lucide-react";

interface SubscriptionStatus {
  isTrialActive: boolean;
  hasActiveSubscription: boolean;
  canSubscribeMonthly: boolean;
  daysUntilSubscriptionOffer: number;
}

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

  const { data: subStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60 * 1000,
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

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/checkout", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not start subscription checkout. Please try again.",
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

  const now = new Date();
  const thisMonthSales = sales.filter((sale) => {
    const d = new Date(sale.saleDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + parseFloat(s.saleAmount), 0);
  const thisMonthFeeAt1Pct = thisMonthTotal * 0.01;
  const monthlyPlanSaves = thisMonthFeeAt1Pct > 9.99;
  const monthlySavings = thisMonthFeeAt1Pct - 9.99;

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
            <h1 className="text-4xl font-bold tracking-tight">Sales & Earnings</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Track your sales — 1% service fee applies after your 30-day free trial
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
                Service Fees (1%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500" data-testid="text-total-fees">
                -${totalFees.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Auto-deducted</p>
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

        {subStatus && !subStatus.hasActiveSubscription && !subStatus.isTrialActive && (
          subStatus.canSubscribeMonthly ? (
            <Card className="mb-6 border-violet-500/40 bg-violet-500/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-violet-500/20">
                    <Star className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-violet-300">Switch to a Flat Monthly Plan</CardTitle>
                    <CardDescription>You've been using Global Lister for 90+ days — save money with a simple flat rate</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-violet-300">$9.99<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                        <div className="text-xs text-muted-foreground">Flat monthly rate</div>
                      </div>
                      <div className="text-muted-foreground">vs</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">1%<span className="text-sm font-normal text-muted-foreground"> per sale</span></div>
                        <div className="text-xs text-muted-foreground">Pay as you go</div>
                      </div>
                    </div>
                    {thisMonthTotal > 0 ? (
                      <div className={`rounded-lg px-4 py-3 text-sm ${monthlyPlanSaves ? "bg-green-500/10 border border-green-500/30" : "bg-muted/30 border border-muted/50"}`}>
                        <div className="font-medium mb-1">
                          {monthlyPlanSaves ? "✓ Monthly plan would save you money right now" : "Pay-per-sale is cheaper for you right now"}
                        </div>
                        <div className="text-muted-foreground text-xs space-y-0.5">
                          <div>This month's sales: <span className="text-foreground font-medium">${thisMonthTotal.toFixed(2)}</span></div>
                          <div>1% fee on that: <span className="text-orange-400 font-medium">${thisMonthFeeAt1Pct.toFixed(2)}</span></div>
                          {monthlyPlanSaves
                            ? <div className="text-green-400">Monthly plan would save you <strong>${monthlySavings.toFixed(2)}</strong> this month</div>
                            : <div>Monthly plan breaks even when sales exceed <strong>$999/mo</strong></div>
                          }
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Monthly plan saves you money once your sales exceed <strong>$999/month</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      onClick={() => subscribeMutation.mutate()}
                      disabled={subscribeMutation.isPending}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      data-testid="button-subscribe-monthly"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {subscribeMutation.isPending ? "Loading..." : "Switch to $9.99/mo"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Or keep paying 1% per sale</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-muted/40 bg-muted/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>A flat <strong>$9.99/month</strong> plan becomes available after 90 days of use — unlocks in <strong>{subStatus.daysUntilSubscriptionOffer} days</strong></span>
                </div>
              </CardContent>
            </Card>
          )
        )}

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
                          disabled={payFeeMutation.isPending}
                          data-testid={`button-pay-fee-${sale.id}`}
                        >
                          <CreditCard className="w-3 h-3" />
                          Pay 1% Fee (${parseFloat(sale.ourFee).toFixed(2)})
                        </Button>
                      )}
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
                        <div className="text-sm text-muted-foreground">Service Fee (1%)</div>
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
