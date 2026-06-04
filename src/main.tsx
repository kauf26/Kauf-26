import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { BrowserRouter } from "react-router-dom";
import { ProductDraftProvider } from "./ProductDraftContext";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
 throw new Error("Root element not found");
}

createRoot(rootElement).render(
 <React.StrictMode>
   <QueryClientProvider client={queryClient}>
     <BrowserRouter>
       <ProductDraftProvider>
         <App />
       </ProductDraftProvider>
     </BrowserRouter>
   </QueryClientProvider>
 </React.StrictMode>
);
