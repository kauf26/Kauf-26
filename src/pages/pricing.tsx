import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Zap,
  CheckCircle2,
  PhoneCall,
  Star,
  TrendingUp,
} from "lucide-react";
import { DAILY_PRODUCT_CREATE_LIMIT } from "@shared/limits";

interface Tier {
  name: string;
  min: number;
  max: number;
  surchargeCents: number;
  surcharge: number;
}

interface SubscriptionStatus {
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndsAt: string;
  trialStartedAt: string;
  monthlySaleCount: number;
  tier: Tier;
  allTiers: Tier[];
}

const TIER_ROWS = [
  { label: "0 – 25 sales/month",   surcharge: "$0",     note: "2% per sale only" },
  { label: "26 – 50 sales/month",  surcharge: "$4.99",  note: "+ 2% per sale" },
  { label: "51 – 100 sales/month", surcharge: "$9.99",  note: "+ 2% per sale" },
  { label: "101 – 250 sales/month",surcharge: "$19.99", note: "+ 2% per sale" },
  { label: "251 – 500 sales/month",surcharge: "$49.99", note: "+ 2% per sale" },
  { label: "500+ sales/month",     surcharge: "Contact support", note: "Enterprise pricing" },
];

export default function PricingPage() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
  });

  const paySurchargeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/pay-surcharge", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: () => {
      toast({ title: "Something went wrong", description: "Could not open payment. Please try again.", variant: "destructive" });
    },
  });

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("surcharge_paid") === "true") {
      window.history.replaceState({}, "", "/pricing");
      toast({ title: "Surcharge paid!", description: "Thank you — your monthly surcharge has been settled." });
    }
  }

  if (isLoading || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { isTrialActive, trialDaysRemaining, monthlySaleCount, tier } = status;
  const hasSurcharge = tier.surchargeCents > 0 && tier.surchargeCents !== -1;
  const isEnterprise = tier.surchargeCents === -1;

  // Find which row index is the current tier
  const tierIndex = ["Starter","Basic","Standard","Professional","Business","Enterprise"].indexOf(tier.name);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-2">
            <Star className="w-4 h-4" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Pay Only When You Sell</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            No subscriptions. No upfront cost. Just 2% per sale — plus a small monthly surcharge if your volume grows.
          </p>
        </div>

        {/* Trial / current status banner */}
        {isTrialActive ? (
          <div className="mb-8 bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4 max-w-sm mx-auto text-center space-y-1">
            <p className="text-sm font-semibold text-primary">Free Trial Active</p>
            <p className="text-xs text-muted-foreground">
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining — up to {DAILY_PRODUCT_CREATE_LIMIT} new listings per calendar day.
              After your trial, there is no subscription; you still pay only when you sell.
            </p>
          </div>
        ) : (
          <div className="mb-8 bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 max-w-sm mx-auto space-y-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              <p className="text-sm font-semibold text-green-400">Active — {tier.name} Tier</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {monthlySaleCount} sale{monthlySaleCount !== 1 ? "s" : ""} recorded this month
              {hasSurcharge ? ` · $${tier.surcharge.toFixed(2)}/month surcharge applies` : " · No monthly surcharge at this volume"}
            </p>
          </div>
        )}

        {/* Surcharge due panel */}
        {!isTrialActive && hasSurcharge && (
          <div className="mb-8 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-4 max-w-sm mx-auto space-y-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-400">Monthly surcharge due</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your {monthlySaleCount} sales this month place you in the <strong className="text-foreground">{tier.name} tier</strong>.
                  The <strong className="text-foreground">${tier.surcharge.toFixed(2)}/month</strong> surcharge can be paid via Stripe
                  or automatically deducted from your sale proceeds.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => paySurchargeMutation.mutate()}
              disabled={paySurchargeMutation.isPending}
              data-testid="button-pay-surcharge"
            >
              {paySurchargeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening payment…</>
              ) : (
                <>Pay ${tier.surcharge.toFixed(2)} surcharge</>
              )}
            </Button>
          </div>
        )}

        {/* Enterprise contact panel */}
        {!isTrialActive && isEnterprise && (
          <div className="mb-8 bg-purple-500/10 border border-purple-500/20 rounded-2xl px-6 py-4 max-w-sm mx-auto space-y-3 text-center">
            <PhoneCall className="w-6 h-6 text-purple-400 mx-auto" />
            <p className="text-sm font-semibold text-purple-400">Enterprise Volume Detected</p>
            <p className="text-xs text-muted-foreground">
              You have more than 500 sales this month. Please contact us for custom enterprise pricing.
            </p>
            <a href="mailto:kaufit@yahoo.com" data-testid="link-enterprise-contact">
              <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Contact Support
              </Button>
            </a>
          </div>
        )}

        {/* Tier table */}
        <div className="rounded-2xl border overflow-hidden mb-10">
          <div className="bg-muted/30 px-6 py-4 border-b">
            <h2 className="font-semibold">Monthly Tier Surcharge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Based on sales recorded in the current calendar month. Resets on the 1st.</p>
          </div>
          <div className="divide-y">
            {TIER_ROWS.map((row, i) => {
              const isCurrent = !isTrialActive && i === tierIndex;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-4 ${isCurrent ? "bg-primary/5 border-l-4 border-l-primary" : ""}`}
                  data-testid={`row-tier-${i}`}
                >
                  <div className="flex items-center gap-3">
                    {isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                        {row.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : row.surcharge === "Contact support" ? "text-purple-400" : "text-foreground"}`}>
                      {row.surcharge}
                    </p>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs border-primary text-primary mt-1">Current</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How billing works */}
        <div className="bg-muted/20 rounded-2xl px-6 py-6 mb-10 space-y-3">
          <h3 className="font-semibold text-foreground">How billing works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span><strong className="text-foreground">2% per sale, always.</strong> Each time you log a sale, a 2% service fee applies. This is the same at every tier.</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span><strong className="text-foreground">Monthly surcharge based on volume.</strong> If you close more than 25 sales in a calendar month, a flat monthly surcharge applies for that month only.</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span><strong className="text-foreground">Deducted from proceeds or billed to card.</strong> The monthly surcharge can be automatically deducted from your Stripe sale proceeds, or you can pay it directly via the button above. We'll never charge more than what's shown.</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span><strong className="text-foreground">Resets on the 1st.</strong> Your sale count resets at the start of each calendar month. A slow month means a lower tier automatically.</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span><strong className="text-foreground">No subscription required.</strong> Your account stays active after the 30-day trial with no action needed. You only pay when you sell.</span></li>
          </ul>
        </div>

        {/* FAQ */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="space-y-5 text-sm">
            <div>
              <p className="font-semibold mb-1">Does my account get shut off after the free trial?</p>
              <p className="text-muted-foreground">No — your account continues automatically. You can keep listing and selling. The 2% per-sale fee kicks in after the trial, and monthly surcharges apply based on your volume. No manual upgrade required.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Is the 2% fee on every product I list, or only what sells?</p>
              <p className="text-muted-foreground">Only what sells. If you have 500 products live and one sells for $50, the fee is $1.00. Nothing is charged on the other 499.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">How does the monthly surcharge get paid?</p>
              <p className="text-muted-foreground">You can pay it directly via Stripe using the "Pay surcharge" button, or we can deduct it automatically from your sale proceeds. Either way, the amount is always exactly what's shown in the tier table — no surprises.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What if I sell a lot one month and less the next?</p>
              <p className="text-muted-foreground">Your tier is recalculated fresh each calendar month. A slow month means a lower tier — or no surcharge at all if you're under 25 sales.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Are there any other fees?</p>
              <p className="text-muted-foreground">No hidden fees from KAUF. Each marketplace takes their own standard cut (e.g. eBay ~13%, Etsy ~6.5%) — those are separate and set by the platforms themselves.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What if I have more than 500 sales a month?</p>
              <p className="text-muted-foreground">Reach out to us at <a href="mailto:kaufit@yahoo.com" className="underline hover:text-foreground">kaufit@yahoo.com</a> for custom enterprise pricing tailored to your volume.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Is my payment secure?</p>
              <p className="text-muted-foreground">All payments are processed by Stripe — the same provider used by Amazon, Shopify, and millions of other businesses. We never see or store your card details.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
