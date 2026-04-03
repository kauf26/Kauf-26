import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Listings from "@/pages/listings";
import Sales from "@/pages/sales";
import Tools from "@/pages/tools";
import Dashboard from "@/pages/dashboard";
import Terms from "@/pages/terms";
import { Home as HomeIcon, ShoppingBag, DollarSign, Wrench, LayoutDashboard, Clock, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionStatus {
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndsAt: string;
  subscriptionStatus: string;
  hasActiveSubscription: boolean;
  canSubscribeMonthly: boolean;
  daysUntilSubscriptionOffer: number;
}

function TrialBanner({ status }: { status: SubscriptionStatus }) {
  if (status.hasActiveSubscription) {
    return (
      <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <Zap className="w-4 h-4 text-green-500" />
        <span className="text-green-400">Pro Plan active — 1% fee on transactions</span>
      </div>
    );
  }

  if (!status.isTrialActive) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 text-sm flex-wrap">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-red-300">Your free trial has ended.</span>
        <Button
          size="sm"
          className="h-7 px-3 bg-red-500 hover:bg-red-600 text-white"
          onClick={() => window.location.href = "/sales"}
          data-testid="banner-upgrade-button"
        >
          Pay Fees in Sales
        </Button>
      </div>
    );
  }

  const urgency = status.trialDaysRemaining <= 5;
  return (
    <div className={`border-b px-4 py-2 flex items-center justify-center gap-2 text-sm flex-wrap ${urgency ? "bg-orange-500/10 border-orange-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
      <Clock className={`w-4 h-4 shrink-0 ${urgency ? "text-orange-400" : "text-blue-400"}`} />
      <span className={urgency ? "text-orange-300" : "text-blue-300"}>
        Free trial: <strong>{status.trialDaysRemaining} day{status.trialDaysRemaining !== 1 ? "s" : ""} remaining</strong> — 1% fee applies after trial
      </span>
      <span className={urgency ? "text-orange-400 text-xs" : "text-blue-400 text-xs"}>
        No charge until trial ends.
      </span>
    </div>
  );
}

function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Upload", icon: HomeIcon },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/listings", label: "Listings", icon: ShoppingBag },
    { path: "/sales", label: "Sales", icon: DollarSign },
    { path: "/tools", label: "Tools", icon: Wrench },
  ];

  return (
    <nav className="border-b bg-card">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Global Lister</span>
          </Link>
          
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center gap-2"
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  return (
    <>
      <Navigation />
      {subscriptionStatus && <TrialBanner status={subscriptionStatus} />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/listings" component={Listings} />
        <Route path="/sales" component={Sales} />
        <Route path="/tools" component={Tools} />
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
      <footer className="border-t bg-card mt-auto py-4 px-4 text-center text-xs text-muted-foreground">
        <span>Global Marketplace Lister is a listing assistance tool only. All transactions occur between you and the respective marketplace. </span>
        <Link href="/terms" className="underline hover:text-foreground transition-colors">
          Terms of Service & Legal Disclaimer
        </Link>
      </footer>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
