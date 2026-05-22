import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import multer from "multer";
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fetchMasterProductData } from './scrapers/masterScraper.js';
import { productRoutes } from "./productsRoutes";

dotenv.config();

// Define the interface with flexible types for prices
interface ScrapedProduct {
  brand?: string;
  year?: string;
  condition?: string;
  material?: string;
  refNumber?: string;
  description?: string;
  price?: string | number;   // Allow both string and number
  ebayPrice?: string | number; // Allow both string and number
 }

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api", productRoutes);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
try {
  if (!req.file) return res.status(400).json({ error: "No image" });

  const base64Image = req.file.buffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: [{ type: "text", text: "Identify product name" }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }] }],
  });

  const searchQuery = response.choices[0].message.content || "";
  // Tell TypeScript that fetchMasterProductData returns our ScrapedProduct interface
  const listings: ScrapedProduct = await fetchMasterProductData(searchQuery);

  res.json({
    success: true,
    productData: {
      capturedImage: `data:${req.file.mimetype};base64,${base64Image}`,
      modelName: searchQuery,
      brand: listings.brand || "Not Found",
      year: listings.year || new Date().getFullYear().toString(),
      condition: listings.condition || "Used",
      material: listings.material || "Not specified",
      refNumber: listings.refNumber || "AUTO-GEN",
      aiDescription: listings.description || `KAUF-AI identified this as: ${searchQuery}`
    },
    marketPrices: {
      allegroAvg: listings.price || "0.00",
      ebayAvg: listings.ebayPrice || "0.00",
      recommendedPrice: listings.price || "0.00"
    }
  });
} catch (error) {
  console.error("Identification Error:", error);
  res.status(500).json({ error: "Scraping failed" });
}
});

const server = createServer(app);

(async () => {
await registerRoutes(app);
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}
const port = 5173;
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Unified Kauf26 engine running on port ${port}`);
});
})();