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
import Auth from "@/pages/auth";
import { Home as HomeIcon, ShoppingBag, DollarSign, Wrench, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

function useAuth() {
  const { data: authStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) throw new Error("Failed to check auth");
      return res.json();
    },
  });

  const isAuthenticated = sessionStorage.getItem("authenticated") === "true";
  const needsAuth = authStatus?.hasPinSet && !isAuthenticated;
  const needsSetup = authStatus && !authStatus.hasPinSet;

  return { isAuthenticated, needsAuth, needsSetup, authStatus };
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { needsAuth, needsSetup } = useAuth();
  
  if (needsAuth || needsSetup) {
    return <Redirect to="/auth" />;
  }
  
  return <Component />;
}

function Navigation() {
  const [location, setLocation] = useLocation();
  const { authStatus } = useAuth();

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    setLocation("/auth");
  };

  const navItems = [
    { path: "/", label: "Upload", icon: HomeIcon },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/listings", label: "Listings", icon: ShoppingBag },
    { path: "/sales", label: "Sales", icon: DollarSign },
    { path: "/tools", label: "Tools", icon: Wrench },
  ];

  if (location === "/auth") return null;

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
            {authStatus?.hasPinSet && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2 text-muted-foreground"
                data-testid="nav-logout"
              >
                <LogOut className="w-4 h-4" />
                Lock
              </Button>
            )}
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
        <Route path="/auth" component={Auth} />
        <Route path="/">
          <ProtectedRoute component={Home} />
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/listings">
          <ProtectedRoute component={Listings} />
        </Route>
        <Route path="/sales">
          <ProtectedRoute component={Sales} />
        </Route>
        <Route path="/tools">
          <ProtectedRoute component={Tools} />
        </Route>
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
