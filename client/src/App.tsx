import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Listings from "@/pages/listings";
import Sales from "@/pages/sales";
import Tools from "@/pages/tools";
import Dashboard from "@/pages/dashboard";
import { Home as HomeIcon, ShoppingBag, DollarSign, Wrench, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/listings" component={Listings} />
        <Route path="/sales" component={Sales} />
        <Route path="/tools" component={Tools} />
        <Route component={NotFound} />
      </Switch>
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
