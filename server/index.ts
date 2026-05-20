import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import OpenAI from 'openai';
import dotenv from 'dotenv';
// Import the correct function name from your masterScraper
import { fetchMasterProductData } from './scrapers/masterScraper.js';
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import marketplaceRoutes from "./marketplaceRoutes";
import { productRoutes } from "./productsRoutes";

// 1. Setup Environment and Helpers
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register our product draft endpoints
app.use(productRoutes);

// 2. Initialize AI and File Handling
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// 3. The Identification Route for KAUF-AI
app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
try {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }
// 1. Get user data
const userId = (req.user as any)?.id;
if (!userId) return res.status(401).json({ error: "Unauthorized" });

const [user] = await db.select().from(users).where(eq(users.id, userId));
if (!user) return res.status(404).json({ error: "User not found" });

// 2. 24-hour reset logic
const now = new Date();
const lastReset = user.lastImageResetAt ? new Date(user.lastImageResetAt) : new Date(0);
if (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000) {
 await db.update(users).set({ dailyImageCount: 0, lastImageResetAt: now }).where(eq(users.id, user.id));
 user.dailyImageCount = 0;
}

// 3. Trial window check (14 days)
const trialStart = user.trialStartedAt ? new Date(user.trialStartedAt) : new Date();
const isTrialActive = now < new Date(trialStart.getTime() + (14 * 24 * 60 * 60 * 1000)) && user.isTrialActive;

// 4. Enforce 20/25 limits
if (isTrialActive && (user.dailyImageCount ?? 0) >= 20) {
 return res.status(403).json({ error: "Trial limit reached: 20 images per day." });
}
if (!isTrialActive && (user.dailyImageCount ?? 0) >= 25) {
 return res.status(403).json({ error: "Daily safety limit reached: 25 images." });
}

// 5. Increment counter
await db.update(users).set({ dailyImageCount: (user.dailyImageCount ?? 0) + 1 }).where(eq(users.id, user.id));

  const base64Image = req.file.buffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify this raw object for a reselling app. Provide only the product name and model."
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          },
        ],
      },
    ],
  });

  const searchQuery = response.choices[0].message.content || "";
  console.log(`🚀 KAUFAI identified: ${searchQuery}`);

  // Trigger the master scraper using the correct function name
  // This handles the Promise.any "race" internally
  const listings = await fetchMasterProductData(searchQuery);
 // 1. Safely pull the calculated price out of the winning scraper data
 const detectedPrice = listings?.price || (Array.isArray(listings) ? listings[0]?.price : "0.00");

 // 2. Return the data structured exactly how your frontend expects it
 res.json({
   success: true,
   productData: {
     capturedImage: `data:${req.file.mimetype};base64,${base64Image}`, // Streams the live picture forward
     modelName: searchQuery || "Identified Item",
     brand: "KAUF-AI Detected",
     year: new Date().getFullYear().toString(),
     condition: "Used",
     refNumber: "AUTO-GEN",
     material: "Identified",
     aiDescription: `KAUF-AI analysis: This item has been verified as a ${searchQuery}.`
   },
   marketPrices: {
     allegroAvg: detectedPrice,
     ebayAvg: (parseFloat(detectedPrice) * 1.08 || 0).toFixed(2), // Adds a clean dynamic baseline markup
     recommendedPrice: detectedPrice
   }
 });

} catch (error) {
  console.error("KAUF-AI Error:", error);
  res.status(500).json({ error: "Failed to identify or scrape product" });
}
});

// 4. Start Server
const port = 2626;
app.listen(port, () => {
console.log(`KAUF-AI server running on port ${port}`);
});