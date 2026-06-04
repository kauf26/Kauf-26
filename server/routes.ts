import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import * as StripeModule from "./stripeClient.js";
import { scrapeProduct as fetchMasterProductData } from "./scrapers/masterScraper.js";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
  });

  console.log("🚀 Registering API routes...");

  // 1. Scraper Route - Updated with Gatekeeper logic
  app.post("/api/catalog/scrape", async (req, res) => {
    console.log("[API] Received request for: /api/catalog/scrape");
    try {
      const query = req.body?.query ?? req.body?.imageUrl ?? req.body?.imageData;
      const searchQuery =
        typeof req.body?.searchQuery === "string"
          ? req.body.searchQuery.trim()
          : "";
      const visionTitle =
        typeof req.body?.visionTitle === "string"
          ? req.body.visionTitle.trim()
          : "";
      const visionBrand =
        typeof req.body?.visionBrand === "string"
          ? req.body.visionBrand.trim()
          : "";

      const primaryQuery = (searchQuery || query) as string | undefined;

      if (!primaryQuery || typeof primaryQuery !== "string") {
        return res.status(400).json({ message: "Product query (model name) is required" });
      }

      // GATEKEEPER: Prevent the scraper from running on AI failure messages
      const lowerQuery = primaryQuery.toLowerCase();
      if (lowerQuery.includes("can't identify") || lowerQuery.includes("unable to identify")) {
        console.warn("[API] Aborting scrape: AI identification failed.");
        return res.status(422).json({ 
          message: "Product could not be identified automatically. Please enter product details manually." 
        });
      }

      const visionTitleResolved = visionTitle || primaryQuery;
      console.log("[API] /api/catalog/scrape", {
        searchQuery: searchQuery || null,
        query: primaryQuery,
        visionTitle: visionTitleResolved,
        visionBrand: visionBrand || null,
      });

      const productData = await fetchMasterProductData(primaryQuery, {
        vision: {
          visionTitle: visionTitleResolved,
          visionBrand,
        },
        searchQuery: searchQuery || undefined,
      });
      
      if (!productData) {
        return res.status(404).json({ message: "Could not identify product" });
      }

      return res.json(productData);
    } catch (error: any) {
      console.error("Master Scraper Route Error:", error);
      return res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  // 2. Stripe Checkout
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { userId, itemSalePrice, userSalesCount } = req.body;
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

  // 3. 30-day Escrow Hold
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

  // 4. Manual Scraper Data Push
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

  const httpServer = createServer(app);
  return httpServer;
}
