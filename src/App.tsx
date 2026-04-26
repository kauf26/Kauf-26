import Dashboard from "./pages/dashboard";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Inventory from "./pages/inventory";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import Listings from "./pages/listings";
import Sales from "./pages/sales";
import Tools from "./pages/tools";
import Terms from "./pages/terms";
import Privacy from "./pages/privacy";
import Submit from "./pages/submit";
import Create from "./pages/create";
import SettingsPage from "./pages/settings";
import PricingPage from "./pages/pricing";
import LoginPage from "./pages/login";
import Screenshots from "./pages/screenshots";
import { DAILY_PRODUCT_CREATE_LIMIT } from "../../shared/schema";

import {
 Home as HomeIcon, ShoppingBag, Search, PlusSquare, User,
 Settings, LogOut, Lock, ChevronRight, AlertTriangle,
 Info, Clock, CheckCircle2, Package, ArrowRight,
 MoreVertical, Camera, DollarSign, LayoutDashboard
} from "lucide-react";

export function App() {
 return (
   <QueryClientProvider client={queryClient}>
     <TooltipProvider>
       <Switch>
         <Route path="/" component={Home} />
         <Route path="/dashboard" component={Dashboard} />
         <Route path="/inventory" component={Inventory} />
         <Route path="/listings" component={Listings} />
         <Route path="/sales" component={Sales} />
         <Route path="/tools" component={Tools} />
         <Route path="/terms" component={Terms} />
         <Route path="/privacy" component={Privacy} />
         <Route path="/submit" component={Submit} />
         <Route path="/create" component={Create} />
         <Route path="/settings" component={SettingsPage} />
         <Route path="/pricing" component={PricingPage} />
         <Route path="/login" component={LoginPage} />
         <Route path="/screenshots" component={Screenshots} />
         <Route component={NotFound} />
       </Switch>
       <Toaster />
     </TooltipProvider>
   </QueryClientProvider>
 );
}

export default App;
