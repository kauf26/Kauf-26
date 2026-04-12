import express, { type Express } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { currencyRates, resolveMarketplaceLocale } from "./marketplaceMeta";
import type { Listing } from "@shared/schema";
import { DAILY_PRODUCT_CREATE_LIMIT } from "@shared/limits";
import { getClientIanaTimeZone } from "./clientTimezone";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === "en") return text;
  const langLabel =
    targetLang === "es"
      ? "Spanish"
      : targetLang === "ja"
        ? "Japanese"
        : targetLang === "pt"
          ? "Portuguese"
          : targetLang === "nl"
            ? "Dutch"
            : "the target language";
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the following text to ${langLabel}. Maintain the same tone and style. Return ONLY the translated text, no explanations.`,
      },
      { role: "user", content: text },
    ],
  });
  return response.choices[0]?.message?.content || text;
}

function publicUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function serializeListingForApi(
  row: Listing & { imageUrl?: string | null },
): Record<string, unknown> {
  const priceNum = parseFloat(row.localPrice);
  const imageUrl = row.imageUrl ?? null;
  return {
    id: row.id,
    productId: row.productId,
    marketplace: row.marketplace,
    marketplaceListingId: row.marketplaceListingId,
    translatedTitle: row.translatedTitle,
    translatedDescription: row.translatedDescription,
    localPrice: row.localPrice,
    localCurrency: row.localCurrency,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    title: row.translatedTitle,
    price: Number.isFinite(priceNum) ? priceNum : 0,
    imageUrl,
  };
}

export function registerCatalogRoutes(app: Express): void {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/products", async (_req, res) => {
    try {
      res.json(await storage.getAllProducts());
    } catch {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(parseInt(req.params.id, 10));
      if (!product) return res.status(404).json({ error: "Product not found" });
      const productListings = await storage.getListingsByProduct(product.id);
      res.json({ ...product, listings: productListings });
    } catch {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products/analyze", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image uploaded" });

      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const extToMime: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        heic: "image/heic",
        heif: "image/heif",
      };
      const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
      const mimeType = req.file.mimetype || extToMime[ext] || `image/${ext}`;
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'You are an expert product identifier for e-commerce listings. Analyze this product image carefully.\n\nSTEP 1: Try to identify the EXACT product — brand, model name, model number, color/variant.\n\nIF YOU RECOGNIZE THE EXACT PRODUCT (e.g. \'Nike Air Max 270\', \'Sony WH-1000XM5\', \'KitchenAid Stand Mixer 5Qt\'):\n- title: Full exact product name with brand and model (e.g. \'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black\')\n- description: Write the full official-style product description as it would appear on the manufacturer website or Amazon listing. Include: what it is, key specs, key features and benefits, materials/construction, what\'s in the box if known, and who it\'s best for. Be thorough — aim for 150-250 words.\n- exactMatch: true\n- suggestedPrice: your best estimate of the retail/resale price in USD as a number\n\nIF YOU CANNOT IDENTIFY THE EXACT PRODUCT:\n- title: A clear descriptive title (max 12 words)\n- description: Write exactly 3 sentences. Sentence 1: what the product is. Sentence 2: its key visible features or materials. Sentence 3: who would want it and why.\n- exactMatch: false\n- suggestedPrice: your best estimate of a fair selling price in USD as a number\n\nReturn ONLY valid JSON: {"title": "...", "description": "...", "exactMatch": boolean, "suggestedPrice": number}',
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json({
        imageUrl: publicUploadUrl(req.file.filename),
        title: result.title || "Untitled Product",
        description: result.description || "No description available.",
        exactMatch: result.exactMatch === true,
        suggestedPrice: result.suggestedPrice ?? null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[catalog] analyze:", msg);
      res.status(500).json({ error: "Failed to analyze product" });
    }
  });

  app.post("/api/products/analyze-base64", async (req, res) => {
    try {
      const { image } = req.body as { image?: string };
      if (!image) return res.status(400).json({ error: "No image provided" });

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
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json({
        title: result.title || "Untitled Product",
        description: result.description || "No description available.",
        suggestedPrice: result.suggestedPrice ?? 0,
        exactMatch: result.exactMatch === true,
      });
    } catch {
      res.status(500).json({ error: "Failed to analyze product" });
    }
  });

  app.post("/api/products/upload-additional", upload.array("images", 5), async (req, res) => {
    try {
      const files = req.files;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }
      res.json({ urls: files.map((f) => publicUploadUrl(f.filename)) });
    } catch {
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  app.get("/api/usage/daily", async (req, res) => {
    try {
      const tz = getClientIanaTimeZone(req);
      const [productsCreatedToday, resetAt] = await Promise.all([
        storage.countProductsCreatedOnUserCalendarDay(tz),
        storage.getNextUserLocalMidnightUtc(tz),
      ]);
      res.json({
        productsCreatedToday,
        limit: DAILY_PRODUCT_CREATE_LIMIT,
        resetAt: resetAt.toISOString(),
        timeZone: tz,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const tz = getClientIanaTimeZone(req);
      const createdToday = await storage.countProductsCreatedOnUserCalendarDay(tz);
      if (createdToday >= DAILY_PRODUCT_CREATE_LIMIT) {
        const resetAt = await storage.getNextUserLocalMidnightUtc(tz);
        return res.status(429).json({
          message: `Daily limit reached: you can create up to ${DAILY_PRODUCT_CREATE_LIMIT} listings per calendar day. Your limit resets at midnight local time.`,
          resetAt: resetAt.toISOString(),
          timeZone: tz,
        });
      }

      const { imageUrl, additionalImages, originalTitle, aiDescription, basePrice, currency, quantity } =
        req.body as Record<string, unknown>;
      const product = await storage.createProduct({
        imageUrl: String(imageUrl),
        additionalImages: Array.isArray(additionalImages) ? (additionalImages as string[]) : [],
        originalTitle: String(originalTitle),
        aiDescription: String(aiDescription),
        basePrice: String(basePrice),
        currency: typeof currency === "string" ? currency : "USD",
        quantity: quantity != null ? parseInt(String(quantity), 10) || 1 : 1,
      });
      res.status(201).json(product);
    } catch {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.post("/api/products/:id/list", async (req, res) => {
    try {
      const productId = parseInt(req.params.id, 10);
      const { selectedMarketplaces } = req.body as { selectedMarketplaces?: string[] };
      if (!Array.isArray(selectedMarketplaces) || selectedMarketplaces.length === 0) {
        return res.status(400).json({ error: "selectedMarketplaces required" });
      }
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const created: Listing[] = [];
      for (const marketplace of selectedMarketplaces) {
        const { lang, currency: targetCurrency } = resolveMarketplaceLocale(marketplace);
        const translatedTitle = await translateText(product.originalTitle, lang);
        const translatedDescription = await translateText(product.aiDescription, lang);
        const baseRate = currencyRates[product.currency] || 1;
        const targetRate = currencyRates[targetCurrency] || 1;
        const localPrice = ((parseFloat(product.basePrice) / baseRate) * targetRate).toFixed(2);
        const row = await storage.createListing({
          productId,
          marketplace,
          marketplaceListingId: null,
          translatedTitle,
          translatedDescription,
          localPrice,
          localCurrency: targetCurrency,
          status: "active",
        });
        created.push(row);
      }
      res.status(201).json({ listings: created });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[catalog] list:", msg);
      res.status(500).json({ error: "Failed to create listings" });
    }
  });

  app.get("/api/listings", async (_req, res) => {
    try {
      const rows = await storage.getAllListingsWithProductMedia();
      res.json(
        rows.map(({ listing, productImageUrl }) =>
          serializeListingForApi({ ...listing, imageUrl: productImageUrl }),
        ),
      );
    } catch {
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.delete("/api/listings/product/:productId", async (req, res) => {
    try {
      await storage.deleteListingsByProduct(parseInt(req.params.productId, 10));
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete listings" });
    }
  });

  app.delete("/api/listings/:id", async (req, res) => {
    try {
      await storage.deleteListing(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });
}
