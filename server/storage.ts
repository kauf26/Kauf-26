import { users, products, type User, type InsertUser, type InsertProduct } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
 getUser(id: number): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(sub: string): Promise<void>;
 createProduct(product: InsertProduct): Promise<any>;
 getCommissionRate(): Promise<number>;
 getDailyProductLimitLockoutBody(): Promise<any>;
 // Added for Stripe Webhooks
 updateSaleFeePaid(saleId: number): Promise<void>;
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

 async createProduct(insertProduct: InsertProduct) {
   const [product] = await db.insert(products).values(insertProduct).returning();
   return product;
 }

 async getCommissionRate(): Promise<number> {
   return 0.10;
 }

 async getDailyProductLimitLockoutBody(): Promise<any> {
   return {
     status: "locked",
     message: "Daily limit reached.",
     upgradeUrl: "/upgrade"
   };
 }

 async updateSaleFeePaid(saleId: number): Promise<void> {
   // If 'status' gives you a red line again, check shared/schema.ts
   // to see if you named the column 'plan' or 'isPaid' instead.
   await db.update(users)
     .set({ status: 'paid' } as any)
     .where(eq(users.id, saleId));

   console.log(`Sale ${saleId} marked as paid in local DB.`);
 }
}

export const storage = new DatabaseStorage();