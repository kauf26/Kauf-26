import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Setup paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load .env from the root Kauf26_Local folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// 3. LOG TO TERMINAL: Verify environment
console.log("-----------------------------------------");
console.log("🔑 API Key Status:", process.env.APIFY_API_KEY ? "✅ Found it!" : "❌ Missing!");
console.log("📁 Current Directory:", process.cwd());
console.log("-----------------------------------------");

const client = new ApifyClient({
   token: process.env.APIFY_API_KEY,
});

export const scrapeProduct = async (url: string) => {
   if (!url) {
       console.error("❌ Error: Please provide a URL.");
       return;
   }

   try {
       console.log(`🚀 Scraping ${url} using Apify...`);

       // Trigger the actor with proxy configuration to bypass 403 errors
       const run = await client.actor("apify/web-scraper").call({
           startUrls: [{ url }],
           runMode: "DEVELOPMENT",
           // This is the key change to bypass blocks
           proxyConfiguration: {
               useApifyProxy: true,
               apifyProxyGroups: ['RESIDENTIAL']
           },
           pageFunction: `async function pageFunction(context) {
               const { request, log } = context;
               const title = document.querySelector('h1')?.innerText.trim();
               const price = document.querySelector('[class*="price"]')?.innerText.trim();

               return {
                   url: request.url,
                   title: title || "Title not found",
                   price: price || "Price not found",
               };
           }`,
       });

       // Fetch the results from the run
       const { items } = await client.dataset(run.defaultDatasetId).listItems();
       console.log("📦 Scraped Data:", items);
       return items;

   } catch (error) {
       console.error("❌ Scraping failed:", error);
   }
};

// Allow terminal execution: npx tsx server/scrapers/apify.ts "URL_HERE"
const urlArg = process.argv[2];
if (urlArg) {
   scrapeProduct(urlArg);
}
