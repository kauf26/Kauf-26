import { users, products, type User, type InsertUser, type InsertProduct, type Product } from "@shared/schema";
import { db, pool } from "./db.js";
import * as drizzle from "drizzle-orm";
const eq = (drizzle as any).eq;
import session from "express-session";
import connectPg from "connect-pg-simple";
import { ConfigService } from "./remoteConfig.js";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
 getUser(id: number): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(sub: string): Promise<void>;
 createProduct(product: InsertProduct): Promise<Product>;
 saveProduct(product: any): Promise<any>; // 
 getCommissionRate(): Promise<number>;
 getDailyProductLimitLockoutBody(): Promise<any>;
 updateSaleFeePaid(saleId: number, isPaid: boolean): Promise<void>;
 sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
 sessionStore: session.Store;

 constructor() {
  this.sessionStore = new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
  });
}

 async getUser(id: number): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.id, id));
   return user;
 }

 async getUserByUsername(username: string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.username, username));
   return user;
 }

 async createUser(insertUser: InsertUser): Promise<User> {
   const [user] = await db.insert(users).values(insertUser).returning();
   return user;
 }

 async deleteUser(sub: string): Promise<void> {
   await db.delete(users).where(eq(users.sub, sub));
 }

 async createProduct(insertProduct: InsertProduct): Promise<Product> {
   const [product] = await db.insert(products).values(insertProduct).returning();
   return product;
 }
 async saveProduct(insertData: any): Promise<any> {
  const [newProduct] = await db
    .insert(products)
    .values({
      name: insertData.title, // Maps 'title' from the scraper to 'name' in your schema
      description: insertData.description || '',
      imageUrl: insertData.imageUrl || '',
      basePrice: insertData.price.toString(), // Maps to your 'basePrice' decimal field
      currency: 'USD', // Satisfies .notNull() with a default fallback
      subcategory: insertData.source || 'scraped', // Satisfies your required subcategory field
      category: 'Scraped Items', // Optional: provides a baseline classification
    })
    .returning();

  return newProduct;
}


 /**
  * Kauf26 Revenue Model: 3% Commission
  *
  */
 async getCommissionRate(): Promise<number> {
   try {
     const config = ConfigService.getInstance();
     const rate = await config.get("commission_rate");
     return rate || 0.03;
   } catch {
     return 0.03;
   }
 }

 /**
  * Updates database to confirm fee payment
  *
  */
 async updateSaleFeePaid(saleId: number, isPaid: boolean): Promise<void> {
   await db.update(users)
     .set({ status: isPaid ? 'paid' : 'unpaid' } as any)
     .where(eq(users.id, saleId));

   console.log(`Sale ${saleId} marked as ${isPaid ? 'paid' : 'unpaid'} in local DB.`);
 }

 /**
  * Enforces 14-Day Free Trial Urgency
  *
  */
 async getDailyProductLimitLockoutBody(): Promise<any> {
   return {
     status: "locked",
     message: "Trial period ended. Please upgrade to continue.",
     trialLength: "14 days",
     upgradeUrl: "/upgrade"
   };
 }
}

export const storage = new DatabaseStorage();

/**
* Marketplace Helpers for Global Expansion
*
*/
export const getMarketplaceCondition = (marketplaceId: string, isNew: boolean): string => {
 const conditionMap: Record<string, { new: string; used: string }> = {
   ebay: { new: "1000", used: "3000" },
   vinted: { new: "new_with_tags", used: "very_good" },
   allegro: { new: "new", used: "used" },
   depop: { new: "brand_new", used: "used" },
   stockx: { new: "new", used: "used" },
   default: { new: "new", used: "used" },
 };

 const platform = conditionMap[marketplaceId] || conditionMap.default;
 return isNew ? platform.new : platform.used;
};

export const getMarketplaceCurrency = (marketplaceId: string): string => {
 const currencyByPlatform: Record<string, string> = {
   aliexpress: "CNY",
   allegro: "PLN",
   amazon: "USD",
   bigcommerce: "USD",
   bolcom: "EUR",
   depop: "USD",
   ebay: "USD",
   etsy: "USD",
   flipkart: "INR",
   fruugo: "GBP",
   lazada: "SGD",
   magento: "USD",
   mercadolibre: "ARS",
   mercadolibre_br: "BRL",
   newegg: "USD",
   poshmark: "USD",
   rakuten: "JPY",
   shopee: "SGD",
   shopify: "USD",
   stockx: "USD",
   taobao: "CNY",
   tiktokshop: "USD",
   vinted: "EUR",
   wayfair: "USD",
   woocommerce: "USD",
   zalando: "EUR",
 };
 return currencyByPlatform[marketplaceId] ?? "USD";
};