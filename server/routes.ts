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

 // 3. Manual Scraper Data Push Route
 app.post("/api/products/save", async (req, res) => {
   try {
     const { title, description, imageUrl, price, source } = req.body;

     if (!title || !price) {
       return res.status(400).json({ message: "Product title and price are required." });
     }

     const savedProduct = await storage.saveProduct({
       title,
       description: description || '',
       imageUrl: imageUrl || '',
       price: typeof price === 'string' ? parseFloat(price) : price,
       source: source || 'scraped'
     });

     return res.json({ success: true, product: savedProduct });
   } catch (error: any) {
     console.error("Save Product Error:", error);
     return res.status(500).json({ message: error.message || "Internal Server Error" });
   }
 });

 // 4. Missing Draft Processing & Scraping Route
 app.post("/api/drafts", async (req, res) => {
   try {
     const { capturedImage, modelName, brand, year, condition, category } = req.body;

     console.log("Received product draft data for scraping:", { modelName, brand, year });

     // Build out the response object matching the ProductDraft interface
     const processedDraft = {
       id: Date.now(),
       capturedImage: capturedImage || '',
       modelName: modelName || '',
       brand: brand || '',
       year: year ? Number(year) : 2026,
       condition: condition || '',
       category: category || '',
       allegroAvg: 0, // Scraper pipelines will populate these values
       ebayAvg: 0
     };

     // TODO: Wire up your local scraping modules here to process the brand/model name
     // and save the returned draft row into your local PostgreSQL instance:
     // await storage.saveDraft(processedDraft);

     return res.json(processedDraft);
   } catch (error: any) {
     console.error("Draft Processing Error:", error);
     return res.status(500).json({ message: error.message || "Internal Server Error" });
   }
 });

 // Create and return the HTTP server
 const httpServer = createServer(app);
 return httpServer;
}