import { users, products, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { db } from "./db";
import * as drizzle from "drizzle-orm";
import { ConfigService } from "./remoteConfig";

// Shortcut for the 'eq' function to clear squiggles
const eq = (drizzle as any).eq;

export interface IStorage {
 getUser(id: number): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(sub: string): Promise<void>;
 createProduct(product: InsertProduct): Promise<Product>;
 getCommissionRate(): Promise<number>;
 getDailyProductLimitLockoutBody(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
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
   // This is the correct way to handle the 'sub' field
   await db.delete(users).where(eq(users.sub, sub));
 }

 async createProduct(insertProduct: InsertProduct): Promise<Product> {
   const [product] = await db.insert(products).values(insertProduct).returning();
   return product;
 }

 async getCommissionRate(): Promise<number> {
   const config = ConfigService.getInstance();
   const rate = await config.get("commission_rate");
   return rate || 0.10;
 }

 async getDailyProductLimitLockoutBody(): Promise<any> {
   return {
     status: "locked",
     message: "Daily limit reached.",
     upgradeUrl: "/upgrade"
   };
 }
}

export const storage = new DatabaseStorage();
// --- MARKETPLACE P2P HELPERS (Lines 61+) ---

/**
* Maps internal condition booleans to marketplace-specific strings.
* Critical for P2P expansion in France/Spain (Vinted, Wallapop).
*/
export const getMarketplaceCondition = (marketplaceId: string, isNew: boolean): string => {
  const conditionMap: Record<string, { new: string; used: string }> = {
    ebay: { new: "1000", used: "3000" },
    vinted: { new: "new_with_tags", used: "very_good" },
    wallapop: { new: "new", used: "as_new" },
    backmarket: { new: "new", used: "reconditioned" },
    etsy: { new: "made_to_order", used: "vintage" },
    cdiscount: { new: "neuf", used: "occasion" },
    default: { new: "new", used: "used" }
  };
 
  const platform = conditionMap[marketplaceId] || conditionMap.default;
  return isNew ? platform.new : platform.used;
 };
 
 /**
 * Returns regional currency based on the target marketplace.
 */
 export const getMarketplaceCurrency = (marketplaceId: string): string => {
  const euroPlatforms = ['vinted', 'wallapop', 'backmarket', 'cdiscount', 'manomano', 'rakuten_fr', 'allegro'];
  return euroPlatforms.includes(marketplaceId) ? 'EUR' : 'USD';
 };