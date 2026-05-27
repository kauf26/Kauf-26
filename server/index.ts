import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import multer from "multer";
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fetchMasterProductData } from './scrapers/masterScraper';
import { productRoutes } from "./productsRoutes";   // ✅ fixed import (added 's')

dotenv.config();

interface ScrapedProduct {
 brand?: string;
 year?: string;
 condition?: string;
 material?: string;
 refNumber?: string;
 description?: string;
 price?: string | number;
 ebayPrice?: string | number;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// -------------------- IDENTIFY ROUTE (image -> scrape) --------------------
app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
 try {
   if (!req.file) {
     return res.status(400).json({ error: "No image uploaded" });
   }

   const base64Image = req.file.buffer.toString('base64');
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: [{
       role: "user",
       content: [
         { type: "text", text: "Identify the product name from this image" },
         { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
       ]
     }],
   });

   const searchQuery = response.choices[0].message.content || "";
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
   res.status(500).json({ error: "Scraping or identification failed" });
 }
});

// -------------------- SERVER SETUP --------------------
const server = createServer(app);

(async () => {
 console.log("DEBUG: About to call registerRoutes");
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