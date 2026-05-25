// src/lib/marketplaces.ts

export const MASTER_MARKETPLACES = [
    { id: "ebay", name: "eBay US", currency: "USD" },
    { id: "amazon", name: "Amazon US", currency: "USD" },
    { id: "depop", name: "Depop", currency: "USD" },
    // ... Add all 26 of your marketplaces here ...
   ] as const;
   
   // This gives you a type that updates itself whenever you change the list above
   export type Marketplace = typeof MASTER_MARKETPLACES[number];
   export type MarketplaceId = Marketplace["id"];