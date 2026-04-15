import { users, products, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
 // User Methods
 getUser(id: number | string): Promise<User | undefined>;
 getUserByUsername(username: string): Promise<User | undefined>;
 createUser(user: InsertUser): Promise<User>;
 deleteUser(userId: string): Promise<void>;

 // Product Methods
 getProduct(id: number): Promise<Product | undefined>;
 getProductsByUserId(userId: number): Promise<Product[]>;
 createProduct(product: InsertProduct): Promise<Product>;

 sessionStore: session.Store;
}
