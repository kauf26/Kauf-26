import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";

// PAGE IMPORTS
import Welcome from "./Welcome";
import Dashboard from "./pages/dashboard";
import Inventory from "./pages/inventory";
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

function Router() {
 return (
   <Switch>
     <Route path="/" component={Welcome} />
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
     {/* Default to Welcome page */}
     <Route component={Welcome} />
   </Switch>
 );
}

function App() {
 return (
   <QueryClientProvider client={queryClient}>
     <TooltipProvider>
       <Router />
       <Toaster />
     </TooltipProvider>
   </QueryClientProvider>
 );
}

export default App;
