import { users, products, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { ConfigService } from "./remoteConfig";

export interface IStorage {
 getUser(id: number): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(sub: string): Promise<void>; // Added this
 createProduct(product: InsertProduct): Promise<Product>;
 getCommissionRate(): Promise<number>;
 getDailyProductLimitLockoutBody(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
 async getUser(id: number): Promise<User | undefined> {
   // implementation
   return undefined;
 }

 async getUserByUsername(username: string): Promise<User | undefined> {
   // implementation
   return undefined;
 }

 async createUser(insertUser: InsertUser): Promise<User> {
   // implementation
   throw new Error("Not implemented");
 }

 // THIS FIXES THE RED SQUIGGLE ON LINE 22
 async deleteUser(sub: string): Promise<void> {
   console.log(`Deleting user with sub: ${sub}`);
   // If using Drizzle: await db.delete(users).where(eq(users.sub, sub));
 }

 async createProduct(insertProduct: InsertProduct): Promise<Product> {
   const maxListings = 5; // Or pull from ConfigService
   const userProducts = []; // Logic to fetch current count

   if (userProducts.length >= maxListings) {
     throw new Error('Limit reached: You can only have 5 listings.');
   }
   // insert logic here
   throw new Error("Not implemented");
 }

 async getCommissionRate(): Promise<number> {
   const config = ConfigService.getInstance();
   const rate = await config.get("commission_rate");
   return rate;
 }

 async getDailyProductLimitLockoutBody(): Promise<any> {
   return {
     status: "locked",
     message: "Daily limit reached."
   };
 }
}

export const storage = new DatabaseStorage();
