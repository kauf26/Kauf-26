import { users, type User, type InsertUser } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
 getUser(id: number | string): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
 async getUser(id: number | string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.id, String(id)));
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

 async deleteUser(userId: string): Promise<void> {
   await db.delete(users).where(eq(users.id, userId));
 }
}

export const authStorage = new DatabaseStorage();