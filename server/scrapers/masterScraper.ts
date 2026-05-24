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
 modelNumber?: string;
 material?: string;
 allegroAverage?: number;
 ebayAverage?: number;
 isExactMatch?: boolean;
};

// The structure that ProductDraft.tsx expects
type DraftForUI = {
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
 return {
   title: raw.title || "Unknown Product",
   brand: raw.brand || "",
   description: raw.description || "",
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

// Save exactly what ProductDraft expects
export const saveToDraftStorage = (product: ScrapedProduct, capturedImage: string = ""): void => {
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
 // KEY MUST MATCH ProductDraft.tsx
 sessionStorage.setItem('pendingAnalysis', JSON.stringify(draft));
 console.log('💾 Scraped data saved to sessionStorage (key: pendingAnalysis)');
 console.log('Saved data:', draft);
};

export const scrapeAndGoToDraft = async (query: string, capturedImage?: string, shouldNavigate: boolean = true): Promise<void> => {
 const scraped = await fetchMasterProductData(query);
 saveToDraftStorage(scraped, capturedImage || "");
 if (shouldNavigate && typeof window !== 'undefined') {
   window.location.hash = '/product-draft';
 }
};