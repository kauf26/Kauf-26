// server/scrapers/apify.ts
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

// Enforce 50-word limit
const truncateDescription = (text: string, query: string): string => {
 if (!text) return `A general listing for ${query}.`;
 const words = text.split(/\s+/);
 return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

export const scrapeProduct = async (query: string): Promise<any> => {
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
   console.error('❌ Apify Error:', error);
   return getGeneralDescription(query);
 }
};

function getGeneralDescription(query: string) {
 return {
   title: query,
   brand: 'N/A',
   description: `A general item matching the search criteria for "${query}". Please review the details manually.`,
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