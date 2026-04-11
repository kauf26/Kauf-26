import { pgTable, serial, text, timestamp, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const marketplaces = ["ebay", "poshmark", "mercari", "depop"] as const;

export const users = pgTable("users", {
 id: serial("id").primaryKey(),
 username: text("username").notNull().unique(),
 email: text("email").notNull().unique(),
 firstLoginAt: timestamp("first_login_at"),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const products = pgTable("products", {
 id: serial("id").primaryKey(),
 name: text("name").notNull(),
 description: text("description"),
 category: text("category"),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const listings = pgTable("listings", {
 id: serial("id").primaryKey(),
 productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
 platform: text("platform").notNull(),
 externalId: text("external_id"),
 status: text("status").notNull().default("active"),
 price: decimal("price", { precision: 10, scale: 2 }).notNull(),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sales = pgTable("sales", {
 id: serial("id").primaryKey(),
 listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
 saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(),
 saleCurrency: text("sale_currency").notNull(),
 platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull().default("0"),
 ourFee: decimal("our_fee", { precision: 10, scale: 2 }).notNull(),
 platform: text("platform").notNull().default("web"),
 feePaid: boolean("fee_paid").notNull().default(false),
 saleDate: timestamp("sale_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
 buyerInfo: text("buyer_info"),
 shippingLabelGenerated: boolean("shipping_label_generated").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({
 createdAt: true
});

export type User = typeof users.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Marketplace = (typeof marketplaces)[number];
export type UpsertUser = z.infer<typeof insertUserSchema>;