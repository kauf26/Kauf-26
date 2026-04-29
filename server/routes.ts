<<<<<<< HEAD
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

export async function registerRoutes(app: any) {
 // Your route definitions will go here
 // Example:
 // app.get("/api/data", async (req, res) => {
 //   const rate = await storage.getCommissionRate();
 //   res.json({ rate });
 // });

 return storage;
}
=======
import type { Express } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";
import * as StripeModule from "./stripeClient";

export async function registerRoutes(app: Express): Promise<Server> {
 const stripeClient = (StripeModule as any).stripeClient || (StripeModule as any).default?.stripeClient;

 // 1. API Routes
 app.post("/api/create-checkout-session", async (req, res) => {
   try {
     const { userId } = req.body;
     if (!userId) return res.status(400).json({ message: "User ID is required" });
     const session = await stripeClient.createSubscriptionSession(userId);
     res.json({ url: session.url });
   } catch (error: any) {
     res.status(500).json({ message: error.message });
   }
 });

 const httpServer = createServer(app);
 return httpServer;
}
>>>>>>> 2054f48
