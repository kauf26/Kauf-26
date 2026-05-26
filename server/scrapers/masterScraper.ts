// masterScraper.ts
import { scrapeProduct as scrapeOxylabs } from './oxylabs.js';
import { scrapeProduct as scrapeApify } from './apify.js';
import { scrapeProduct as scrapeRapidAPI } from './rapidapi.js';

// Truncate text to a maximum number of words
const truncateToWords = (text: string, maxWords: number = 50): string => {
 if (!text) return "";
 const words = text.split(/\s+/).filter(w => w.length > 0);
 if (words.length <= maxWords) return text;
 return words.slice(0, maxWords).join(" ") + "...";
};

export type ScrapedProduct = {
 title: string;
 brand?: string;
 description?: string;
 price?: number;
 category?: string;
 condition?: string;
 modelNumber?: string;
 material?: string;
 allegroAverage?: number;
 ebayAverage?: number;
 isExactMatch?: boolean;
};

// The structure that IdentificationResults and ProductDraft expect
export type DraftForUI = {
 title: string;
 brand: string;
 price: string;
 description: string;
 category: string;
 condition: string;
 modelNumber: string;
 material: string;
 allegroAverage: string;
 ebayAverage: string;
 capturedImage: string;
 isExactMatch: boolean;
};

const normalizeResponse = (raw: any): ScrapedProduct => {
 const rawDescription = raw.description || "";
 return {
   title: raw.title || "Unknown Product",
   brand: raw.brand || "",
   description: truncateToWords(rawDescription, 40),
   price: typeof raw.price === 'number' ? raw.price : undefined,
   category: raw.category || "General",
   condition: raw.condition || "New",
   modelNumber: raw.modelNumber || "",
   material: raw.material || "",
   allegroAverage: raw.allegroAverage,
   ebayAverage: raw.ebayAverage,
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
   // Returns the first successful response
   const firstResult = await Promise.any(tasks);
   console.log(`✅ Master Scraper succeeded: ${firstResult.title}`);
   return firstResult;
 } catch (error) {
   console.error('❌ All scrapers failed:', error);
   return {
     title: query || 'Manual Entry Required',
     brand: '',
     description: 'Product detected but details could not be auto-generated.',
     price: undefined,
     category: 'General',
     condition: 'New',
     isExactMatch: false,
   };
 }
};

export const saveToDraftStorage = (product: ScrapedProduct, capturedImage: string = ""): DraftForUI => {
 const draft: DraftForUI = {
   title: product.title,
   brand: product.brand || '',
   price: product.price?.toString() || '0.00',
   description: product.description || '',
   category: product.category || 'General',
   condition: product.condition || 'New',
   modelNumber: product.modelNumber || '',
   material: product.material || '',
   allegroAverage: product.allegroAverage?.toString() || '0.00',
   ebayAverage: product.ebayAverage?.toString() || '0.00',
   capturedImage: capturedImage,
   isExactMatch: product.isExactMatch ?? true,
 };

 sessionStorage.setItem('pendingAnalysis', JSON.stringify(draft));
 console.log('💾 Data saved to sessionStorage', draft);
 return draft;
};