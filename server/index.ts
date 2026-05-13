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

// 1. Setup Environment and Helpers
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 2. Initialize AI and File Handling
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// 3. The Identification Route for KAUF-AI
app.post('/api/identify', upload.single('image'), async (req: Request, res: Response) => {
 try {
   if (!req.file) {
     return res.status(400).json({ error: "No image uploaded" });
   }

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

   res.json({
     success: true,
     description: searchQuery,
     listings: listings,
     // Safely extract price from whatever scraper won the race
     price: listings?.price || (Array.isArray(listings) ? listings[0]?.price : "N/A")
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