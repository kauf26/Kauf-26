import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";

import Welcome from "./Welcome";
import ProductDraftPage from "./pages/ProductDraft";
import SelectMarketPlaces from "./SelectMarketPlaces";
import Dashboard from "./pages/dashboard";
import Inventory from "./pages/inventory";
import Listings from "./pages/listings";
import Sales from "./pages/sales";
import Tools from "./pages/tools";
import Create from "./pages/create";
import Submit from "./pages/submit";
import LoginPage from "./pages/login";
import PricingPage from "./pages/pricing";
import Terms from "./pages/terms";
import Privacy from "./pages/privacy";
import SettingsPage from "./pages/settings";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <main className="flex-grow">
            <Switch>
              <Route path="/product-draft" component={ProductDraftPage} />
              <Route path="/select-marketplaces" component={SelectMarketPlaces} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/inventory" component={Inventory} />
              <Route path="/listings" component={Listings} />
              <Route path="/sales" component={Sales} />
              <Route path="/tools" component={Tools} />
              <Route path="/create" component={Create} />
              <Route path="/submit" component={Submit} />
              <Route path="/login" component={LoginPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/terms" component={Terms} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/" component={Welcome} />
            </Switch>
          </main>

          {/* Footer with only text - no logo */}
          <footer className="p-6 text-center mt-auto border-t">
            <span className="text-sm font-medium" style={{ color: "#C084FC" }}>
              Sold with KAUF
            </span>
          </footer>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;