import { pgTable, text, decimal, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

// 1. Define the marketplaces array for the type system\
export const marketplaces = [
    "ebay",
    "amazon",
    "walmart",
    "wish",
    "reverb",
    "offerup",
    "etsy",
    "shopify",
    "woocommerce",
    "aliexpress",
    "mercadolibre",
    "rakuten",
    "bigcommerce",
    "prestashop"
   ] as const;

// 2. Define the Users table
export const users = pgTable("users", {
 id: serial("id").primaryKey(),
 username: text("username").notNull().unique(),
 email: text("email").notNull().unique(),
 firstLoginAt: timestamp("first_login_at"),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 3. Define the Products table
export const products = pgTable("products", {
 id: serial("id").primaryKey(),
 aiDescription: text("ai_description").notNull(),
 basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
 currency: text("currency").notNull().default("USD"),
 quantity: integer("quantity").notNull().default(1),
 wish: text("wish"),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 4. Create Zod Schemas for validation
export const insertProductSchema = createInsertSchema(products).omit({
 id: true,
 createdAt: true,
});

// 5. Export Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Marketplace = typeof marketplaces[number];
export type User = typeof users.$inferSelect;
