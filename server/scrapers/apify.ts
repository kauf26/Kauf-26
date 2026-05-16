// apify.ts
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

export const scrapeProduct = async (query: string): Promise<any> => {
 if (!query) {
   console.error('❌ Apify: No search query provided');
   return fallbackProduct(query);
 }

 try {
   console.log(`🔎 Apify: Searching for "${query}" on eBay...`);

   // Use Apify's eBay search actor
   const run = await client.actor("epctex/ebay-scraper").call({
     search: query,
     country: "US",
     limit: 1,
   });

   const dataset = await client.dataset(run.defaultDatasetId);
   const { items } = await dataset.listItems();

   if (!items || items.length === 0) {
     throw new Error('No products found');
   }

   const first = items[0] as any;

   return {
     title: first.title || query,
     brand: first.brand || extractBrandFromTitle(String(first.title || '')),
     description: first.description || `High-quality ${first.title} - sourced from eBay via Apify.`,
     price: parsePrice(first.price),
     category: first.category || 'General',
     condition: first.condition || 'New',
     isExactMatch: true,
   };
 } catch (error: any) {
   console.error('❌ Apify scraping error:', error.message || error);
   return fallbackProduct(query);
 }
};

function extractBrandFromTitle(title: string): string {
 const brands = ['Nikon', 'Canon', 'Sony', 'Apple', 'Samsung', 'LG', 'Bose', 'Dell', 'HP'];
 for (const b of brands) {
   if (title.toLowerCase().includes(b.toLowerCase())) return b;
 }
 return '';
}

function parsePrice(price: any): number | undefined {
 if (typeof price === 'number') return price;
 if (!price) return undefined;
 const str = String(price);
 const match = str.match(/[\d,]+\.?\d*/);
 if (match) return parseFloat(match[0].replace(/,/g, ''));
 return undefined;
}

function fallbackProduct(query: string) {
 return {
   title: query,
   brand: '',
   description: 'Product description not available from Apify.',
   price: undefined,
   category: 'General',
   condition: 'New',
   isExactMatch: false,
 };
}