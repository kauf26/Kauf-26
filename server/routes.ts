import type { Express } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";
import * as StripeModule from "./stripeClient";

export async function registerRoutes(app: Express): Promise<Server> {
 const stripeClient = (StripeModule as any).stripeClient || (StripeModule as any).default?.stripeClient;

 // 1. API Routes
 app.post("/api/create-checkout-session", async (req, res) => {
   try {
     const { userId } = req.body;
     if (!userId) return res.status(400).json({ message: "User ID is required" });
     const session = await stripeClient.createSubscriptionSession(userId);
     res.json({ url: session.url });
   } catch (error: any) {
     res.status(500).json({ message: error.message });
   }
 });

 const httpServer = createServer(app);
 return httpServer;
}