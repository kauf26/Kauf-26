import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import * as StripeModule from "./stripeClient.js";

/**
* Register all Kauf26 API and system routes.
* This version satisfies the 'Express' type requirements and includes
* the updated Per-Sale and Escrow logic.
*/
export async function registerRoutes(app: Express): Promise<Server> {
 const stripeClient = (StripeModule as any).stripeClient || (StripeModule as any).default;

 // 1. API Routes for Kauf26 Marketplace
 app.post("/api/create-checkout-session", async (req, res) => {
   try {
     const { userId, itemSalePrice, userSalesCount } = req.body;

     // Ensure we have the required data for the volume-tier logic
     if (!userId) return res.status(400).json({ message: "User ID required" });

     const session = await (StripeModule as any).createPerSaleCheckoutSession({
       userId,
       itemSalePrice,
       userSalesCount
     });

     res.json({ url: session.url, sessionId: session.id });
   } catch (error: any) {
     console.error("Stripe Checkout Error:", error);
     res.status(500).json({ message: error.message || "Internal Server Error" });
   }
 });

 // 2. API Route for 30-day Escrow Hold
 app.post("/api/create-hold", async (req, res) => {
   try {
     const { userId, amount } = req.body;
     const session = await (StripeModule as any).createHoldPaymentSession({
       userId,
       amount
     });
     res.json({ url: session.url, sessionId: session.id });
   } catch (error: any) {
     console.error("Stripe Hold Error:", error);
     res.status(500).json({ message: error.message || "Internal Server Error" });
   }
 });

 // Create and return the HTTP server
 const httpServer = createServer(app);
 return httpServer;
}