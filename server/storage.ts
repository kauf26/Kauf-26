import { users, products, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte } from "drizzle-orm";

export interface IStorage {
    getUser(id: number): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    deleteUser(userId: string): Promise<void>;
    buildDailyProductLimitLockoutBody(userId: string): Promise<any>;
   }

export class DatabaseStorage implements IStorage {
 async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id.toString())).limit(1);
   return user;
 }

 async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq((users as any).username, username)).limit(1);
   return user;
 }

 async createUser(insertUser: InsertUser): Promise<User> {
   const [user] = await db.insert(users).values(insertUser).returning();
   return user;
 }
 async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }
 async buildDailyProductLimitLockoutBody(userId: string): Promise<boolean> {
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   try {
     const userProducts = await db
       .select()
       .from(products)
       .where(
         and(
           eq((products as any).userId, userId),
           gte((products as any).createdAt, today)
         )
       );

       return userProducts.length >= 50;
    } catch (e) {
        console.error("Error checking product limits:", e);
        return false;
      }
     }
    }
    export const authStorage = new DatabaseStorage();
export type DailyProductLimitLockoutBody = boolean;

    
