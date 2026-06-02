import "dotenv/config";
import express, { type Request, Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import multer from "multer";
import OpenAI from "openai";
import { scrapeProduct as fetchMasterProductData } from "./scrapers/masterScraper";
import { productRoutes } from "./productsRoutes";


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
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mount product routes (handles POST /api/drafts and GET /api/drafts)
app.use("/api", productRoutes);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// -------------------- IDENTIFY ROUTE (image -> scrape -> save to drafts) --------------------
app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
 try {
   console.log("📸 [1/5] Image received. File size:", req.file?.size);

   if (!req.file) {
     console.log("❌ No file in request");
     return res.status(400).json({ error: "No image uploaded" });
   }

   const base64Image = req.file.buffer.toString('base64');

   console.log("🤖 [2/5] Calling OpenAI to identify product...");
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: [{
       role: "user",
       content: [
         { type: "text", text: "Identify the product name from this image. Return only the product name, no extra text." },
         { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
       ]
     }],
   });

   const searchQuery = response.choices[0].message.content || "";
   console.log("🔍 [3/5] OpenAI identified:", searchQuery);

   console.log("🕸️ [4/5] Calling scraper with query:", searchQuery);
   const listings: ScrapedProduct = await fetchMasterProductData(searchQuery);
   console.log("📦 Scraper returned:", JSON.stringify(listings, null, 2));

   // ✨ NEW: Save as a draft in the database
   const draftData = {
     title: searchQuery,
     sku: listings.refNumber || `AUTO-${Date.now()}`,
     status: 'ready_for_posting', // This makes it appear on page 3
     images: [`data:${req.file.mimetype};base64,${base64Image}`],
     attributes: {
       brand: listings.brand || "Unknown",
       year: listings.year || new Date().getFullYear().toString(),
       condition: listings.condition || "Used",
       material: listings.material || "Not specified",
       aiDescription: listings.description || `KAUF-AI identified as: ${searchQuery}`,
       marketPrices: {
         allegroAvg: listings.price || "0.00",
         ebayAvg: listings.ebayPrice || "0.00",
         recommendedPrice: listings.price || "0.00"
       },
       source: 'ai_identified',
       identifiedAt: new Date().toISOString()
     }
   };

   console.log("💾 [5/5] Saving draft to database...");

   // Save to database using your existing productRoutes logic
   const saveResponse = await fetch(`http://localhost:${PORT}/api/drafts`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(draftData)
   });

   if (!saveResponse.ok) {
     throw new Error(`Failed to save draft: ${saveResponse.statusText}`);
   }

   const savedDraft = await saveResponse.json();
   console.log("✅ Draft saved successfully with ID:", savedDraft.id || savedDraft);

   // Return response with draft ID
   res.json({
     success: true,
     draftId: savedDraft.id || savedDraft,
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
   console.error("❌ Identification Error:", error);
   res.status(500).json({ error: "Scraping or identification failed" });
 }
});

// -------------------- HEALTH CHECK ROUTE --------------------
app.get('/api/health', (req: Request, res: Response) => {
 res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

 server.listen(PORT, "0.0.0.0", () => {
   console.log(`🚀 Unified Kauf26 engine running on port ${PORT}`);
   console.log(`📋 API endpoints available:`);
   console.log(`   - POST /api/identify (multipart image → OpenAI → scrape → draft)`);
   console.log(`   - POST /api/catalog/scrape (JSON { query } → masterScraper)`);
   console.log(`   - GET  /api/health`);
   console.log(`   - GET/POST /api/drafts (productsRoutes → PostgreSQL)`);
   console.log(`   - GET  /api/drafts/ready-for-posting`);
   console.log(`   - POST /api/drafts/:id/post-to-marketplaces`);
   console.log(`   - POST /api/products/save`);
   console.log(`   - POST /api/create-checkout-session`);
   console.log(`   - POST /api/create-hold`);
 });
})();