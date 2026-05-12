import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
 throw new Error("Failed to find the root element.");
}

const root = createRoot(rootElement);

root.render(
 <React.StrictMode>
   <QueryClientProvider client={queryClient}>
     <BrowserRouter>
       <App />
     </BrowserRouter>
   </QueryClientProvider>
 </React.StrictMode>
);
