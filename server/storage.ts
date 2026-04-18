import { users, products, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { ConfigService } from "./remoteConfig";

export interface IStorage {
 getUser(id: string): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 getProduct(id: number): Promise<Product | undefined>;
 getProductsByUserId(userId: number): Promise<Product[]>;
 createProduct(product: InsertProduct): Promise<Product>;
}

export class DatabaseStorage implements IStorage {
 async getUser(id: string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.id, id));
   return user || undefined;
 }

 async getUserByUsername(username: string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.username, username));
   return user || undefined;
 }

 async createUser(insertUser: InsertUser): Promise<User> {
   const results = await db.insert(users).values(insertUser).returning();
   return results[0];
 }

 async getProduct(id: number): Promise<Product | undefined> {
   const [product] = await db.select().from(products).where(eq(products.id, id));
   return product || undefined;
 }

 async getProductsByUserId(userId: number): Promise<Product[]> {
   return await db.select().from(products).where(eq(products.userId, userId));
 }
 async createProduct(insertProduct: InsertProduct): Promise<Product> {
  const config = ConfigService.getInstance();

  // 1. Fetch the limit from Firebase
  const maxListings = await config.get("max_listings_free_tier");

  // 2. Count how many products this user already has
  const userProducts = await this.getProductsByUserId(insertProduct.userId);

  // 3. Block creation if they are at or over the limit
  if (userProducts.length >= maxListings) {
    throw new Error(`Limit reached: You can only have ${maxListings} products.`);
  }

  // 4. If under limit, proceed with the original database insert
  const [product] = await db.insert(products).values(insertProduct).returning();
  return product;
}

 async getCommissionRate(): Promise<number> {
   return 0.10;
 }

 async buildDailyProductLimitLockoutBody(): Promise<string> {
   return "Daily limit reached.";
 }

 async DailyProductLimitLockoutBody(): Promise<any> {
   return {
     status: "locked",
     message: await this.buildDailyProductLimitLockoutBody()
   };
 }
}

export const storage = new DatabaseStorage();