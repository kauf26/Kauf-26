import { scrapeProduct as scrapeApify } from "./apify";
import { extractProductData as scrapeOpenAI } from "./openai";
import { scrapeProduct as scrapeOxylabs } from "./oxylabs";
import { scrapeProduct as scrapeRapidAPI } from "./rapidapi";
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

const truncateDescription = (text: string, query: string): string => {
 if (!text) return `A general listing for ${query}.`;
 const words = text.split(/\s+/);
 return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

export const scrapeProduct = async (query: string): Promise<any> => {
 const scrapers = [scrapeApify, scrapeOpenAI, scrapeOxylabs, scrapeRapidAPI];

 console.log(`[MasterScraper] Racing scrapers for: ${query}`);

 // 1. Use allSettled to ensure individual failures don't crash the server
 const results = await Promise.allSettled(scrapers.map(s => s(query)));

 // 2. Find the first result that succeeded (status 'fulfilled') and has a title
 const winner = results.find((res): res is PromiseFulfilledResult<any> =>
   res.status === 'fulfilled' && res.value && res.value.title
 );

 if (winner) {
   console.log(`[MasterScraper] Winner found!`);
   return winner.value;
 }

 // 3. Fallback logic
 console.log("[MasterScraper] All scrapers failed, falling back to internal actor...");
 try {
   const run = await client.actor("epctex/ebay-scraper").call({
     search: query,
     country: "US",
     limit: 1,
   }, { timeout: 30000 });

   const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
   if (!items || items.length === 0) return getGeneralDescription(query);

   const first = items[0] as any;
   return {
     title: first.title || query,
     brand: first.brand || "",
     description: truncateDescription(first.description || "", query),
     price: parsePrice(first.price),
     category: first.category || 'General',
     condition: first.condition || 'New',
     isExactMatch: true,
   };
 } catch (error) {
   console.error('❌ Critical Fallback Error:', error);
   return getGeneralDescription(query);
 }
};

function getGeneralDescription(query: string) {
 return {
   title: query,
   brand: 'N/A',
   description: `A general item matching the search criteria for "${query}".`,
   price: undefined,
   category: 'General',
   condition: 'New',
   isExactMatch: false,
 };
}

function parsePrice(price: any): number | undefined {
 const str = String(price).replace(/[^0-9.]/g, '');
 const parsed = parseFloat(str);
 return isNaN(parsed) ? undefined : parsed;
}