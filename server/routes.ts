import type { Express } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage.js";
// We'll import the whole file to avoid the naming conflict on line 9
import * as StripeModule from "./stripeClient.js";

export async function registerRoutes(app: Express): Promise<Server> {
 // Use a cleaner check to find the stripeClient inside the module
 const stripeClient = (StripeModule as any).stripeClient || (StripeModule as any).default;

 // 1. API Routes
 app.post("/api/create-checkout-session", async (req, res) => {
   try {
     const { userId } = req.body;
     if (!userId) {
       return res.status(400).json({ message: "User ID is required" });
     }

     const session = await stripeClient.createSubscription(userId);
     res.json({ url: session.url });
   } catch (error: any) {
     const message = error instanceof Error ? error.message : String(error);
     res.status(500).json({ message });
   }
 });

 // 2. Initialize and Start the Server
 const httpServer = createServer(app);
 const PORT = 5000;

 httpServer.listen(PORT, "0.0.0.0", () => {
   console.log(`-----------------------------------------`);
   console.log(`🚀 Server connected on http://localhost:${PORT}`);
   console.log(`-----------------------------------------`);
 });

 return httpServer;
}