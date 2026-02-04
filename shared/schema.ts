import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, varchar, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  pin: text("pin"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const pinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  originalTitle: text("original_title").notNull(),
  aiDescription: text("ai_description").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const marketplaces = ["ebay", "amazon", "etsy", "shopify", "woocommerce", "mercadolibre", "rakuten", "depop", "vinted", "grailed"] as const;
export type Marketplace = typeof marketplaces[number];

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  marketplace: text("marketplace").notNull(),
  marketplaceListingId: text("marketplace_listing_id"),
  translatedTitle: text("translated_title").notNull(),
  translatedDescription: text("translated_description").notNull(),
  localPrice: decimal("local_price", { precision: 10, scale: 2 }).notNull(),
  localCurrency: text("local_currency").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(),
  saleCurrency: text("sale_currency").notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  ourFee: decimal("our_fee", { precision: 10, scale: 2 }).notNull(),
  feePaid: boolean("fee_paid").notNull().default(false),
  saleDate: timestamp("sale_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  buyerInfo: text("buyer_info"),
  shippingLabelGenerated: boolean("shipping_label_generated").notNull().default(false),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  saleDate: true,
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
