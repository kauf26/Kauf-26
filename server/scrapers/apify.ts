// server/scrapers/apify.ts
import { ApifyClient } from 'apify-client';
import {
  aggregateListings,
  SCRAPE_LISTING_LIMIT,
  type VisionMatchContext,
} from "./listingUtils";
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

const truncateDescription = (text: string, query: string): string => {
 if (!text) return `A general listing for ${query}.`;
 const words = text.split(/\s+/);
 return words.length > 50 ? words.slice(0, 50).join(" ") + "..." : text;
};

export const scrapeProduct = async (
  query: string,
  context?: VisionMatchContext
): Promise<any> => {
 try {
  const run = await client.actor("YOUR_NEW_ACTOR_ID").call({
     search: query,
     country: "US",
     limit: SCRAPE_LISTING_LIMIT,
   }, { timeout: 30000 });

   const { items } = await client.dataset(run.defaultDatasetId).listItems({
     limit: SCRAPE_LISTING_LIMIT,
   });

   if (!items || items.length === 0) return getGeneralDescription(query);

   const aggregated = aggregateListings(items as any[], query, context);
   if (!aggregated) return getGeneralDescription(query);

   return {
     ...aggregated,
     description: truncateDescription(String(aggregated.description || ""), query),
     category: aggregated.category || "Other",
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
