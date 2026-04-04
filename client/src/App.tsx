import { Switch, Route, Link, useLocation, Redirect } from "wouter";
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
import Privacy from "@/pages/privacy";
import Submit from "@/pages/submit";
import Create from "@/pages/create";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import Screenshots from "@/pages/screenshots";
import {
  Home as HomeIcon,
  ShoppingBag,
  DollarSign,
  Wrench,
  LayoutDashboard,
  Clock,
  Zap,
  AlertTriangle,
  Settings,
  LogOut,
  User,
  MoreHorizontal,
  X,
  FileText,
  Shield,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import Onboarding, { useOnboarding } from "@/components/onboarding";
import { useState } from "react";
import GdprBanner from "@/components/gdpr-banner";

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

const BOTTOM_NAV_ITEMS = [
  { path: "/", label: "Upload", icon: Camera },
  { path: "/listings", label: "Listings", icon: ShoppingBag },
  { path: "/sales", label: "Sales", icon: DollarSign },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const DESKTOP_NAV_ITEMS = [
  { path: "/", label: "Upload", icon: HomeIcon },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/listings", label: "Listings", icon: ShoppingBag },
  { path: "/sales", label: "Sales", icon: DollarSign },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/settings", label: "Connections", icon: Settings },
];

function MoreDrawer({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const navigate = (path: string) => {
    setLocation(path);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid="more-drawer-backdrop"
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-white/10 rounded-t-2xl pb-safe animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {user?.firstName || user?.email?.split("@")[0] || "Account"}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            data-testid="button-more-close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-1">
          <button
            onClick={() => navigate("/tools")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            data-testid="drawer-nav-tools"
          >
            <Wrench className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tools</span>
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            data-testid="drawer-nav-connections"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Connections</span>
          </button>
        </div>

        <div className="mx-3 border-t border-white/10 my-1" />

        <div className="px-3 py-2 space-y-1">
          <button
            onClick={() => navigate("/privacy")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            data-testid="drawer-nav-privacy"
          >
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Privacy Policy</span>
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            data-testid="drawer-nav-terms"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Terms of Service</span>
          </button>
          <button
            onClick={() => { logout(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors text-left"
            data-testid="drawer-button-logout"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            <span className="text-sm font-medium text-red-400">Sign Out</span>
          </button>
        </div>
        <div className="h-4" />
      </div>
    </>
  );
}

function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden md:block border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">Global Lister</span>
            </Link>

            <div className="flex items-center gap-1">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="flex items-center gap-1.5"
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}

              {isAuthenticated && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                  {user?.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="avatar" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {user?.firstName || user?.email?.split("@")[0] || "Account"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => logout()}
                    data-testid="button-logout"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile top header (hidden on desktop) ── */}
      <header className="md:hidden border-b bg-card px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <span className="font-bold text-base">Global Lister</span>
        </Link>
        {isAuthenticated && (
          <button
            onClick={() => setShowMore(true)}
            className="flex items-center gap-2"
            data-testid="button-mobile-account"
          >
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </button>
        )}
      </header>

      {/* ── Mobile bottom tab bar (hidden on desktop) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-white/10 pb-safe"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <div className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                    isActive ? "bg-primary/15" : ""
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </div>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground"
            onClick={() => setShowMore(true)}
            data-testid="mobile-nav-more"
          >
            <div className="w-10 h-7 flex items-center justify-center">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
    </>
  );
}

function ProtectedRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <>
      {showOnboarding && <Onboarding onDismiss={dismissOnboarding} />}
      <Navigation />
      {subscriptionStatus && <TrialBanner status={subscriptionStatus} />}
      {/* pb-20 on mobile so content doesn't hide behind bottom nav */}
      <div className="pb-20 md:pb-0">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/listings" component={Listings} />
          <Route path="/sales" component={Sales} />
          <Route path="/tools" component={Tools} />
          <Route path="/create" component={Create} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
      {/* Footer — desktop only */}
      <footer className="hidden md:block border-t bg-card mt-auto py-4 px-4 text-center text-xs text-muted-foreground space-x-3">
        <span>Global Marketplace Lister — listing assistance tool only.</span>
        <Link href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link href="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</Link>
        <span>·</span>
        <Link href="/submit" className="underline hover:text-foreground transition-colors">Submit to App Stores</Link>
      </footer>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/submit" component={Submit} />
      <Route path="/screenshots" component={Screenshots} />
      <Route component={ProtectedRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <GdprBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
