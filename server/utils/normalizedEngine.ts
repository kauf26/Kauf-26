// server/utils/normalizationEngine.ts
import { NormalizedProduct } from '../types/normalizedProducts';

export const normalizeData = (rawData: any[], source: string): NormalizedProduct[] => {
 return rawData.map((item: any) => {
   switch (source) {
     case 'apify':
       return {
         externalId: item.id || item.url,
         source: 'apify',
         title: item.title?.trim() || 'Title not found',
         price: typeof item.price === 'string'
           ? parseFloat(item.price.replace(/[^0-9.]/g, ''))
           : item.price || 0,
         currency: 'USD',
         imageUrl: item.image || null,
         productUrl: item.url,
         condition: 'unknown',
         lastScrapedAt: new Date(),
       };

     case 'oxylabs':
       return {
         externalId: item.asin || item.product_id,
         source: 'oxylabs',
         title: item.name || 'Title not found',
         price: item.price_str ? parseFloat(item.price_str) : 0,
         currency: item.currency || 'USD',
         imageUrl: item.images?.[0] || null,
         productUrl: item.url,
         condition: 'new',
         lastScrapedAt: new Date(),
       };

     case 'rapidapi':
       return {
         externalId: item.product_id || item.asin,
         source: 'rapidapi',
         title: item.product_title || 'Title not found',
         price: parseFloat(item.product_price) || 0,
         currency: item.currency || 'USD',
         imageUrl: item.product_photo || null,
         productUrl: item.product_url,
         condition: 'new',
         lastScrapedAt: new Date(),
       };

     default:
       throw new Error(`Normalization logic missing for source: ${source}`);
   }
 });
};
