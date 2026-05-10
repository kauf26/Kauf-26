import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";

// PAGE IMPORTS
import Welcome from "./welcome.tsx";
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
     {/* The root path now explicitly loads the Welcome page */}
     <Route path="/" component={Welcome} />

     {/* Dashboard and Main App Routes */}
     <Route path="/dashboard" component={Dashboard} />
     <Route path="/inventory" component={Inventory} />
     <Route path="/listings" component={Listings} />
     <Route path="/sales" component={Sales} />
     <Route path="/tools" component={Tools} />
     <Route path="/create" component={Create} />
     <Route path="/submit" component={Submit} />

     {/* Account and Legal */}
     <Route path="/login" component={LoginPage} />
     <Route path="/pricing" component={PricingPage} />
     <Route path="/settings" component={SettingsPage} />
     <Route path="/terms" component={Terms} />
     <Route path="/privacy" component={Privacy} />

     {/* Fallback: Redirect any unknown routes back to Welcome */}
     <Route>
       <Welcome />
     </Route>
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