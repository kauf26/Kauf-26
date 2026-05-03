// server/types/normalizedProducts.ts

export interface NormalizedProduct {
    externalId: string;      
    source: string;          
    title: string;
    price: number;
    currency: string;
    imageUrl: string | null;
    productUrl: string;
    condition: 'new' | 'used' | 'refurbished' | 'unknown';
    lastScrapedAt: Date;
   }