import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { marketplaces, type Marketplace } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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
  etsy: "en",
  shopify: "en",
  woocommerce: "en",
  mercadolibre: "es",
  rakuten: "ja",
};

const marketplaceCurrencies: Record<Marketplace, string> = {
  ebay: "USD",
  amazon: "USD",
  etsy: "USD",
  shopify: "USD",
  woocommerce: "USD",
  mercadolibre: "MXN",
  rakuten: "JPY",
};

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === "en") return text;
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
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
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this product image and provide: 1) A clear, descriptive product title (max 10 words). 2) A compelling 3-sentence product description suitable for e-commerce listings. Focus on key features, benefits, and appeal to potential buyers. Return in JSON format: {\"title\": \"...\", \"description\": \"...\"}",
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
      });
    } catch (error) {
      console.error("Error analyzing product:", error);
      res.status(500).json({ error: "Failed to analyze product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { imageUrl, originalTitle, aiDescription, basePrice, currency } = req.body;

      const product = await storage.createProduct({
        imageUrl,
        originalTitle,
        aiDescription,
        basePrice,
        currency: currency || "USD",
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

      const ourFee = (parseFloat(saleAmount) * 0.02).toFixed(2);

      const sale = await storage.createSale({
        listingId,
        saleAmount,
        saleCurrency,
        platformFee: platformFee || "0",
        ourFee,
        feePaid: false,
        buyerInfo: req.body.buyerInfo || null,
        shippingLabelGenerated: false,
      });

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

      const labelData = {
        id: `LABEL-${Date.now()}`,
        trackingNumber: `1Z${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
        shipTo,
        shipFrom,
        weight,
        dimensions,
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

  return httpServer;
}
