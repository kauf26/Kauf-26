import { scrapeProduct as scrapeOxylabs } from './oxylabs.js';
import { scrapeProduct as scrapeApify } from './apify.js';
import { scrapeProduct as scrapeRapidAPI } from './rapidapi.js';

// This function orchestrates your different scraping engines
export const fetchMasterProductData = async (query: string) => {
 console.log(`🚀 Starting Master Scraper for: ${query}`);

 try {
   // Promise.any takes an array of "races" and returns the first success
   const firstSuccessfulResult = await Promise.any([
     scrapeOxylabs(query), // Scraper 1 (Oxylabs)
     scrapeApify(query),   // Scraper 2 (Apify)
     scrapeRapidAPI(query) // Scraper 3 (RapidAPI)
   ]);

   return firstSuccessfulResult;
 } catch (error) {
   // This only triggers if EVERY SINGLE scraper fails
   console.error("❌ All scrapers failed to retrieve data.");
   return {
     title: "Manual Entry Required",
     description: "Unable to auto-generate description at this time.",
     isExactMatch: false
   };
 }
};