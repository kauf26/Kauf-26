// masterScraper.ts
import { scrapeProduct as scrapeOxylabs } from './oxylabs.js';
import { scrapeProduct as scrapeApify } from './apify';
import { scrapeProduct as scrapeRapidAPI } from './rapidapi';

export type ScrapedProduct = {
 title: string;
 brand?: string;
 description?: string;
 price?: number;
 category?: string;
 condition?: string;
 isExactMatch?: boolean;
};

type DraftStorage = {
 modelName: string;
 title?: string;
 brand: string;
 aiDescription?: string;
 description: string;
 recommendedPrice?: string | number;
 price?: string;
 category: string;
 condition: string;
 isExactMatch: boolean;
};

const normalizeResponse = (raw: any): ScrapedProduct => {
 return {
   title: raw.title || "Unknown Product",
   brand: raw.brand || "",
   description: raw.description || "",
   price: typeof raw.price === 'number' ? raw.price : undefined,
   category: raw.category || "General",
   condition: raw.condition || "New",
   isExactMatch: raw.isExactMatch !== false,
 };
};

export const fetchMasterProductData = async (query: string): Promise<ScrapedProduct> => {
 console.log(`🔍 Master Scraper started for: "${query}"`);

 const tasks = [
   scrapeOxylabs(query).then(normalizeResponse),
   scrapeApify(query).then(normalizeResponse),
   scrapeRapidAPI(query).then(normalizeResponse),
 ];

 try {
   const firstResult = await Promise.any(tasks);
   console.log(`✅ Master Scraper succeeded: ${firstResult.title}`);
   return firstResult;
 } catch (error) {
   console.error('❌ All scrapers failed:', error);
   return {
     title: query || 'Manual Entry Required',
     brand: '',
     description: 'Unable to auto-generate description at this time.',
     price: undefined,
     category: 'General',
     condition: 'New',
     isExactMatch: false,
   };
 }
};

export const saveToDraftStorage = (product: ScrapedProduct): void => {
 const draft: DraftStorage = {
   modelName: product.title,
   title: product.title,
   brand: product.brand || '',
   aiDescription: product.description,
   description: product.description || '',
   recommendedPrice: product.price,
   price: product.price?.toString(),
   category: product.category || 'General',
   condition: product.condition || 'New',
   isExactMatch: product.isExactMatch ?? true,
 };
 sessionStorage.setItem('pending_kauf26_d', JSON.stringify(draft));
 console.log('💾 Scraped data saved to sessionStorage (key: pending_kauf26_d)');
 console.log('Saved data:', draft);
};

export const scrapeAndGoToDraft = async (query: string, shouldNavigate: boolean = true): Promise<void> => {
 const scraped = await fetchMasterProductData(query);
 saveToDraftStorage(scraped);
 if (shouldNavigate && typeof window !== 'undefined') {
   window.location.hash = '/product-draft';
 }
};