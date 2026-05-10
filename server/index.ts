import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { scrapeProduct } from './scrapers/oxylabs.js';
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

// 3. The Identification Route for Kauf-AI
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
             text: "Identify this raw object for a reselling app. Provide the exact model name and key specs as a single search query for marketplaces."
           },
           {
             type: "image_url",
             image_url: { url: `data:image/jpeg;base64,${base64Image}` },
           },
         ],
       },
     ],
   });

   const searchQuery = response.choices[0].message.content || "";
   console.log(`🚀 KAUFAI identified: ${searchQuery}`);

   // Trigger the scraper using the AI's identification
   const listings = await scrapeProduct(searchQuery);

   res.json({
     description: searchQuery,
     listings: listings
   });

 } catch (error) {
   console.error("KAUFAI Error:", error);
   res.status(500).json({ error: "Identification failed" });
 }
});

// 4. Server Initialization
(async () => {
 const server = await registerRoutes(app);

 if (app.get("env") === "development") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 const PORT = 5001;
 server.listen(PORT, "0.0.0.0", () => {
   console.log(`Kaufai server running on port ${PORT}`);
 });
})();