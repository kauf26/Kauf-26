import { users, products, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
 getUser(id: number | string): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(userId: string): Promise<void>;
 getProduct(id: number): Promise<Product | undefined>;
 getProductsByUserId(userId: number): Promise<Product[]>;
 createProduct(product: InsertProduct): Promise<Product>;
 sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
 public sessionStore: session.Store;

 constructor() {
   this.sessionStore = new PostgresSessionStore({
     pool: pool,
     tableName: 'sessions',
   });
 }

 async getUser(id: number | string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.id, String(id)));
   return user;
 }

 async getUserByUsername(username: string): Promise<User | undefined> {
   const [user] = await db.select().from(users).where(eq(users.username, username));
   return user;
 }
 async getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
 }

 async createUser(insertUser: InsertUser): Promise<User> {
   const [user] = await db.insert(users).values(insertUser).returning();
   return user;
 }

 async deleteUser(userId: string): Promise<void> {
   await db.delete(users).where(eq(users.id, String(userId)));
 }

 async getProduct(id: number): Promise<Product | undefined> {
   const [product] = await db.select().from(products).where(eq(products.id, id));
   return product;
 }

 async getProductsByUserId(userId: number): Promise<Product[]> {
   return await db.select().from(products).where(eq(products.userId, userId));
 }

 async createProduct(insertProduct: InsertProduct): Promise<Product> {
   const [product] = await db.insert(products).values(insertProduct).returning();
   return product;
 }
}

export const storage = new DatabaseStorage();

export function buildDailyProductLimitLockoutBody() {
 return {};
}
