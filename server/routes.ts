import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { marketplaces, type Marketplace } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { getUncachableStripeClient } from "./stripeClient";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  MXN: 17.2,
  BRL: 5.1,
  AUD: 1.52,
  CAD: 1.35,
};

const marketplaceLanguages: Record<Marketplace, string> = {
  ebay: "en",
  amazon: "en",
  walmart: "en",
  wish: "en",
  reverb: "en",
  etsy: "en",
  shopify: "en",
  woocommerce: "en",
  aliexpress: "en",
  mercadolibre: "es",
  rakuten: "ja",
  bigcommerce: "en",
  prestashop: "en",
};

const marketplaceCurrencies: Record<Marketplace, string> = {
  ebay: "USD",
  amazon: "USD",
  walmart: "USD",
  wish: "USD",
  reverb: "USD",
  etsy: "USD",
  shopify: "USD",
  woocommerce: "USD",
  aliexpress: "USD",
  mercadolibre: "MXN",
  rakuten: "JPY",
  bigcommerce: "USD",
  prestashop: "EUR",
};

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === "en") return text;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the following text to ${targetLang === "es" ? "Spanish" : targetLang === "ja" ? "Japanese" : "the target language"}. Maintain the same tone and style. Return ONLY the translated text, no explanations.`,
      },
      { role: "user", content: text },
    ],
  });

  return response.choices[0]?.message?.content || text;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/uploads", (await import("express")).static(path.join(process.cwd(), "uploads")));

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      const listings = await storage.getListingsByProduct(id);
      res.json({ ...product, listings });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products/analyze", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const imageUrl = `data:image/${path.extname(req.file.originalname).slice(1)};base64,${base64Image}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are an expert product identifier for e-commerce listings. Analyze this product image carefully.\n\nSTEP 1: Try to identify the EXACT product — brand, model name, model number, color/variant.\n\nIF YOU RECOGNIZE THE EXACT PRODUCT (e.g. 'Nike Air Max 270', 'Sony WH-1000XM5', 'KitchenAid Stand Mixer 5Qt'):\n- title: Full exact product name with brand and model (e.g. 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black')\n- description: Write the full official-style product description as it would appear on the manufacturer website or Amazon listing. Include: what it is, key specs, key features and benefits, materials/construction, what's in the box if known, and who it's best for. Be thorough — aim for 150-250 words.\n- exactMatch: true\n- suggestedPrice: your best estimate of the retail/resale price in USD as a number\n\nIF YOU CANNOT IDENTIFY THE EXACT PRODUCT:\n- title: A clear descriptive title (max 12 words)\n- description: Write exactly 3 sentences. Sentence 1: what the product is. Sentence 2: its key visible features or materials. Sentence 3: who would want it and why.\n- exactMatch: false\n- suggestedPrice: your best estimate of a fair selling price in USD as a number\n\nReturn ONLY valid JSON: {\"title\": \"...\", \"description\": \"...\", \"exactMatch\": boolean, \"suggestedPrice\": number}",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const publicPath = `/uploads/${req.file.filename}`;

      res.json({
        imageUrl: publicPath,
        title: result.title || "Untitled Product",
        description: result.description || "No description available.",
        exactMatch: result.exactMatch === true,
        suggestedPrice: result.suggestedPrice || null,
      });
    } catch (error) {
      console.error("Error analyzing product:", error);
      res.status(500).json({ error: "Failed to analyze product" });
    }
  });

  // Base64 analyze endpoint for mobile app
  app.post("/api/products/analyze-base64", async (req, res) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this product image carefully. Search your knowledge for an EXACT MATCH - the specific brand, model number, and product name.\n\nIF EXACT MATCH FOUND:\n- Title: The exact brand, model, and product name (e.g. 'Apple iPhone 15 Pro Max 256GB Natural Titanium')\n- Description: Start with '[EXACT MATCH]' then provide the full official product description including all key specs, features, dimensions, materials, and notable details. Be thorough and detailed - include everything a buyer would want to know.\n- exactMatch: true\n\nIF NO EXACT MATCH FOUND:\n- Title: A descriptive title (max 10 words)\n- Description: Exactly 3 sentences. First sentence describes what the product is. Second sentence highlights key features or benefits. Third sentence explains why a buyer would want it.\n- exactMatch: false\n\nAlso provide a suggested retail price in USD.\n\nReturn JSON: {\"title\": \"...\", \"description\": \"...\", \"suggestedPrice\": number, \"exactMatch\": boolean}",
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      
      res.json({
        title: result.title || "Untitled Product",
        description: result.description || "No description available.",
        suggestedPrice: result.suggestedPrice || 0,
      });
    } catch (error) {
      console.error("Error analyzing product:", error);
      res.status(500).json({ error: "Failed to analyze product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { imageUrl, originalTitle, aiDescription, basePrice, currency, quantity } = req.body;

      const product = await storage.createProduct({
        imageUrl,
        originalTitle,
        aiDescription,
        basePrice,
        currency: currency || "USD",
        quantity: quantity ? parseInt(quantity) : 1,
      });

      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.post("/api/products/:id/list", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { selectedMarketplaces } = req.body;

      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const listings = [];

      for (const marketplace of selectedMarketplaces) {
        const targetLang = marketplaceLanguages[marketplace as Marketplace];
        const targetCurrency = marketplaceCurrencies[marketplace as Marketplace];

        const translatedTitle = await translateText(product.originalTitle, targetLang);
        const translatedDescription = await translateText(product.aiDescription, targetLang);

        const baseRate = currencyRates[product.currency] || 1;
        const targetRate = currencyRates[targetCurrency] || 1;
        const localPrice = (parseFloat(product.basePrice) / baseRate) * targetRate;

        const listing = await storage.createListing({
          productId,
          marketplace,
          marketplaceListingId: null,
          translatedTitle,
          translatedDescription,
          localPrice: localPrice.toFixed(2),
          localCurrency: targetCurrency,
          status: "active",
        });

        listings.push(listing);
      }

      res.status(201).json({ listings });
    } catch (error) {
      console.error("Error creating listings:", error);
      res.status(500).json({ error: "Failed to create listings" });
    }
  });

  app.get("/api/listings", async (req, res) => {
    try {
      const listings = await storage.getAllListings();
      res.json(listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.delete("/api/listings/product/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      await storage.deleteListingsByProduct(productId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting listings:", error);
      res.status(500).json({ error: "Failed to delete listings" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { listingId, saleAmount, saleCurrency, platformFee } = req.body;

      const config = await storage.getAppConfig();
      const isTrialActive = config ? (Date.now() - new Date(config.trialStartedAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : true;
      const ourFee = isTrialActive ? "0.00" : (parseFloat(saleAmount) * 0.01).toFixed(2);

      const sale = await storage.createSale({
        listingId,
        saleAmount,
        saleCurrency,
        platformFee: platformFee || "0",
        ourFee,
        feePaid: isTrialActive,
        buyerInfo: req.body.buyerInfo || null,
        shippingLabelGenerated: false,
      });

      // Find the listing to get its product, then decrement quantity
      const allListings = await storage.getAllListings();
      const listing = allListings.find(l => l.id === listingId);
      if (listing) {
        const product = await storage.getProduct(listing.productId);
        if (product) {
          const newQty = Math.max(0, product.quantity - 1);
          await storage.updateProductQuantity(product.id, newQty);
          // If sold out, mark all listings for this product as sold_out
          if (newQty === 0) {
            const productListings = await storage.getListingsByProduct(product.id);
            for (const pl of productListings) {
              await storage.updateListingStatus(pl.id, "sold_out");
            }
          }
        }
      }

      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.post("/api/convert-currency", async (req, res) => {
    try {
      const { amount, from, to } = req.body;

      const fromRate = currencyRates[from] || 1;
      const toRate = currencyRates[to] || 1;
      const converted = (parseFloat(amount) / fromRate) * toRate;

      res.json({
        amount: parseFloat(amount),
        from,
        to,
        converted: parseFloat(converted.toFixed(2)),
        rate: toRate / fromRate,
      });
    } catch (error) {
      console.error("Error converting currency:", error);
      res.status(500).json({ error: "Failed to convert currency" });
    }
  });

  app.post("/api/shipping-label", async (req, res) => {
    try {
      const { saleId, shipTo, shipFrom, weight, dimensions } = req.body;

      // Calculate estimated shipping cost based on weight and dimensions
      const weightNum = parseFloat(weight) || 1;
      const dimParts = (dimensions || "10x10x10").split("x").map((d: string) => parseFloat(d) || 10);
      const dimWeight = (dimParts[0] * dimParts[1] * dimParts[2]) / 139; // Dimensional weight formula
      const billableWeight = Math.max(weightNum, dimWeight);
      
      // Base rates (simulated carrier pricing)
      let estimatedCost = 4.99; // Base rate
      if (billableWeight <= 1) estimatedCost = 4.99;
      else if (billableWeight <= 3) estimatedCost = 7.49;
      else if (billableWeight <= 5) estimatedCost = 9.99;
      else if (billableWeight <= 10) estimatedCost = 14.99;
      else if (billableWeight <= 20) estimatedCost = 19.99;
      else estimatedCost = 19.99 + (billableWeight - 20) * 0.75;

      const labelData = {
        id: `LABEL-${Date.now()}`,
        trackingNumber: `1Z${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
        shipTo,
        shipFrom,
        weight,
        dimensions,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        billableWeight: Math.round(billableWeight * 10) / 10,
        createdAt: new Date().toISOString(),
      };

      res.json(labelData);
    } catch (error) {
      console.error("Error generating shipping label:", error);
      res.status(500).json({ error: "Failed to generate shipping label" });
    }
  });

  app.get("/api/marketplaces", async (req, res) => {
    try {
      res.json({
        marketplaces: marketplaces.map((m) => ({
          id: m,
          name: m.charAt(0).toUpperCase() + m.slice(1),
          language: marketplaceLanguages[m],
          currency: marketplaceCurrencies[m],
        })),
      });
    } catch (error) {
      console.error("Error fetching marketplaces:", error);
      res.status(500).json({ error: "Failed to fetch marketplaces" });
    }
  });

  // Subscription status
  app.get("/api/subscription/status", async (req, res) => {
    try {
      const config = await storage.initAppConfig();
      const trialStartedAt = new Date(config.trialStartedAt);
      const trialDurationMs = 30 * 24 * 60 * 60 * 1000;
      const subscriptionOfferMs = 90 * 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - trialStartedAt.getTime();
      const isTrialActive = elapsed < trialDurationMs;
      const trialDaysRemaining = Math.max(0, Math.ceil((trialDurationMs - elapsed) / (24 * 60 * 60 * 1000)));
      const trialEndsAt = new Date(trialStartedAt.getTime() + trialDurationMs);
      const canSubscribeMonthly = elapsed >= subscriptionOfferMs;
      const daysUntilSubscriptionOffer = Math.max(0, Math.ceil((subscriptionOfferMs - elapsed) / (24 * 60 * 60 * 1000)));

      res.json({
        isTrialActive,
        trialDaysRemaining,
        trialEndsAt: trialEndsAt.toISOString(),
        trialStartedAt: trialStartedAt.toISOString(),
        subscriptionStatus: config.subscriptionStatus,
        hasActiveSubscription: config.subscriptionStatus === "active",
        canSubscribeMonthly,
        daysUntilSubscriptionOffer,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Create subscription checkout session
  app.post("/api/subscription/checkout", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Global Lister — Pro Plan',
              description: '1% fee on all marketplace transactions. Keep listing across all platforms.',
            },
            unit_amount: 999,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/?subscribed=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/?subscribed=false`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ error: "Failed to create subscription session" });
    }
  });

  // Stripe payment for 1% fee
  app.post("/api/sales/:saleId/pay-fee", async (req, res) => {
    try {
      const saleId = parseInt(req.params.saleId);
      const sales = await storage.getAllSales();
      const sale = sales.find(s => s.id === saleId);
      
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (sale.feePaid) {
        return res.status(400).json({ error: "Fee already paid" });
      }

      const stripe = await getUncachableStripeClient();
      const feeInCents = Math.round(parseFloat(sale.ourFee) * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Service Fee - Sale #${saleId}`,
              description: `1% service fee for your marketplace sale`,
            },
            unit_amount: feeInCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/sales?payment=success&saleId=${saleId}`,
        cancel_url: `${req.protocol}://${req.get('host')}/sales?payment=cancelled`,
        metadata: {
          saleId: saleId.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // Mark fee as paid (called after successful payment)
  app.post("/api/sales/:saleId/mark-paid", async (req, res) => {
    try {
      const saleId = parseInt(req.params.saleId);
      await storage.updateSaleFeePaid(saleId, true);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking fee as paid:", error);
      res.status(500).json({ error: "Failed to mark fee as paid" });
    }
  });

  // Dashboard layout routes
  app.get("/api/dashboard/layout", async (req, res) => {
    try {
      const layout = await storage.getDashboardLayout();
      res.json(layout || { layout: null });
    } catch (error) {
      console.error("Error getting dashboard layout:", error);
      res.status(500).json({ error: "Failed to get layout" });
    }
  });

  app.post("/api/dashboard/layout", async (req, res) => {
    try {
      const { layout } = req.body;
      const saved = await storage.saveDashboardLayout(null, JSON.stringify(layout));
      res.json(saved);
    } catch (error) {
      console.error("Error saving dashboard layout:", error);
      res.status(500).json({ error: "Failed to save layout" });
    }
  });

  return httpServer;
}
