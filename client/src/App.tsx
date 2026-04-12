import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
 Home as HomeIcon,
 ShoppingBag,
 Search,
 PlusSquare,
 User,
 Settings,
 LogOut,
 Lock,
 ChevronRight,
 AlertTriangle,
 Info,
 Clock,
 CheckCircle2,
 Package,
 ArrowRight,
 MoreVertical,
 Camera,
 DollarSign,
 LayoutDashboard,
 Star
} from "lucide-react";
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
import PricingPage from "@/pages/pricing";
import LoginPage from "@/pages/login";
import Screenshots from "@/pages/screenshots";
import { DAILY_PRODUCT_CREATE_LIMIT } from "@shared/limits";

interface LockStatus {
 locked: boolean;
 unlockAt: string | null;
 photosToday: number;
 listingsToday: number;
}

interface SubscriptionStatus {
 isTrialActive: boolean;
 trialDaysRemaining: number;
 trialEndsAt: string;
 trialStartedAt: string;
 monthlySaleCount: number;
 tier: {
   name: string;
   min: number;
   max: number;
   surchargeCents: number;
 };
}

function LockScreen({ unlockAt }: { unlockAt: string }) {
 const { logout } = useAuth();
 const unlockDate = new Date(unlockAt);
 const timeStr = unlockDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
 const dateStr = unlockDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

 return (
   <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6">
     <div className="max-w-sm w-full flex flex-col items-center text-center gap-6">
       <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
         <Lock className="w-9 h-9 text-destructive" />
       </div>
       <div className="space-y-2">
         <h1 className="text-2xl font-bold text-foreground">App Locked for Today</h1>
         <p className="text-muted-foreground text-sm leading-relaxed">
           You took {DAILY_PRODUCT_CREATE_LIMIT} photos today without posting any items to a marketplace.
           The app is locked until midnight in your local time zone to encourage active listing.
         </p>
       </div>
       <div className="w-full bg-card border rounded-xl px-5 py-4 space-y-1">
         <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unlocks at</p>
         <p className="text-xl font-bold text-foreground">{timeStr}</p>
         <p className="text-sm text-muted-foreground">{dateStr}</p>
       </div>
       <Button variant="outline" className="w-full gap-2" onClick={() => logout()}>
         <LogOut className="w-4 h-4" />
         Sign Out / Switch Account
       </Button>
     </div>
   </div>
 );
}

function TrialBanner({ status }: { status: SubscriptionStatus }) {
  const [, setLocation] = useLocation();

  if (!status.isTrialActive) {
    const { tier } = status;
    const isEnterprise = tier.surchargeCents === -1;

    if (isEnterprise) {
      return (
        <div className="bg-purple-500/10 border-b border-purple-500/20 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-purple-400">
            <AlertTriangle className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-purple-300">Enterprise Plan</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-primary">
        <Clock className="w-4 h-4" />
        <span className="font-medium">Trial ends in {status.trialDaysRemaining} days</span>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 text-[10px] px-2 hover:bg-primary/20"
        onClick={() => setLocation("/pricing")}
      >
        Upgrade Now
      </Button>
    </div>
  );
}

const navItems = [
  { path: "/", label: "Upload", icon: Camera },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/listings", label: "Listings", icon: ShoppingBag },
  { path: "/sales", label: "Sales", icon: DollarSign },
  { path: "/pricing", label: "Pricing", icon: Star },
];
