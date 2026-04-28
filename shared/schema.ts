import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  varchar,
  jsonb,
  index,
  boolean,
  decimal,
 } from "drizzle-orm/pg-core";
 import { sql } from "drizzle-orm";
 import { createInsertSchema } from "drizzle-zod";
 import { z } from "zod";
 
 // --- MODELS & AUTH EXPORTS ---
 export * from "./models/chat";
 export * from "./models/auth";
 
 // 1. Global Categories & Limits
 export const PRODUCT_CATEGORIES = {
  FOOTWEAR: ["Sneakers", "Boots", "Sandals", "Slides"],
  APPAREL: ["T-Shirts", "Hoodies", "Pants", "Outerwear"],
  ELECTRONICS: ["TVs", "VCRs", "Computers", "Gaming"],
  COLLECTIBLES: ["Trading Cards", "Figures"]
 } as const;
 
 export const DAILY_PRODUCT_CREATE_LIMIT = 10;
 
 // 2. Platform Restrictions
 export const PLATFORM_RESTRICTIONS = {
  "goat": ["FOOTWEAR"],
  "stockx": ["FOOTWEAR", "APPAREL", "COLLECTIBLES"],
  "grailed": ["FOOTWEAR", "APPAREL"],
  "ebay": ["FOOTWEAR", "APPAREL", "ELECTRONICS", "COLLECTIBLES"],
  "shopify": ["FOOTWEAR", "APPAREL", "ELECTRONICS"],
 } as const;
 
 // --- SESSIONS ---
 export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (t) => [index("IDX_session_expire").on(t.expire)]
 );
 
 // --- USERS ---
 export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique(),
  username: varchar("username").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  sub: varchar("sub").unique(),
  firstLoginAt: timestamp("first_login_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  dailyImageCount: integer("daily_image_count").default(0),
  weeklyViolationStrikes: integer("weekly_violation_strikes").default(0),
  lockoutExpiry: timestamp("lockout_expiry"),
  permanentBan: boolean("permanent_ban").default(false),
 });
 
 // --- PRODUCTS ---
 export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  additionalImages: text("additional_images").array(),
  originalTitle: text("original_title").notNull(),
  aiDescription: text("ai_description").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
 });
 
 // --- LISTINGS ---
 export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  marketplace: text("marketplace").notNull(),
  marketplaceListingId: text("marketplace_listing_id"),
  translatedTitle: text("translated_title").notNull(),
  translatedDescription: text("translated_description"),
  localPrice: decimal("local_price", { precision: 10, scale: 2 }),
  localCurrency: text("local_currency").notNull(),
  status: text("status").notNull().default("pending"),
  ebayItemId: text("ebay_item_id"),
  shopifyVariantId: text("shopify_variant_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
 });
 
 // --- CATALOG ITEMS ---
 export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  category: text("category"),
  status: text("status").default("draft"),
  marketplaceData: jsonb("marketplace_data"),
  createdAt: timestamp("created_at").defaultNow(),
 });
 
 // --- MARKETPLACE SETTINGS ---
 export const marketplaceSettings = pgTable("marketplace_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  marketplace: text("marketplace").notNull(),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
 });
 
 // --- AUDIT LOGS ---
 export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
 });
 
 // --- APP CONFIG ---
 export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  trialStartedAt: timestamp("trial_started_at").defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").notNull().default("trialing"),
 });
 
 // --- SCHEMAS & TYPES ---
 export const insertUserSchema = createInsertSchema(users);
 export const insertProductSchema = createInsertSchema(products);
 export const insertListingSchema = createInsertSchema(listings);
 export const insertCatalogItemSchema = createInsertSchema(catalogItems);
 export const insertMarketplaceSettingsSchema = createInsertSchema(marketplaceSettings);
 export const insertAuditLogSchema = createInsertSchema(auditLogs);
 
 export type User = typeof users.$inferSelect;
 export type InsertUser = z.infer<typeof insertUserSchema>;
 export type Product = typeof products.$inferSelect;
 export type InsertProduct = z.infer<typeof insertProductSchema>;
 export type Listing = typeof listings.$inferSelect;
 export type InsertListing = z.infer<typeof insertListingSchema>;
 export type CatalogItem = typeof catalogItems.$inferSelect;
 export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;
 export type MarketplaceSettings = typeof marketplaceSettings.$inferSelect;
 export type AuditLog = typeof auditLogs.$inferSelect;