import { createServer, type Server } from "http";
import type { Express } from "express";
import { storage } from "./storage.js";
import { ConfigService } from "./remoteConfig.js";
import * as stripeService from "./stripeClient.js";

export function registerRoutes(app: Express): Server {
 // Remote Config Route
 app.get("/api/config", async (_req, res) => {
   try {
     const commissionRate = await ConfigService.getCommissionRate();
     res.json({ commissionRate });
   } catch (error) {
     res.status(500).json({ message: "Failed to fetch config" });
   }
 });

 // Stripe Checkout Session Route
 app.post("/api/create-checkout-session", async (req, res) => {
   try {
     const { userId } = req.body;
     if (!userId) {
       return res.status(400).json({ message: "User ID is required" });
     }

     // Ensure this function name matches what is inside stripeClient.ts
     const session = await stripeService.createSubscriptionCheckout(userId);
     res.json({ id: session.id });
   } catch (error: any) {
     res.status(500).json({ message: error.message || "Stripe session creation failed" });
   }
 });

 const httpServer = createServer(app);
 return httpServer;
}