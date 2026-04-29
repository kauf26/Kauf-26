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
<<<<<<< HEAD
  decimal

 } from "drizzle-orm/pg-core";
 import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// 1. Define the Global Categories
export const PRODUCT_CATEGORIES = {
=======
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
>>>>>>> 2054f48
  FOOTWEAR: ["Sneakers", "Boots", "Sandals", "Slides"],
  APPAREL: ["T-Shirts", "Hoodies", "Pants", "Outerwear"],
  ELECTRONICS: ["TVs", "VCRs", "Computers", "Gaming"],
  COLLECTIBLES: ["Trading Cards", "Figures"]
 } as const;
<<<<<<< HEAD
 export const DAILY_PRODUCT_CREATE_LIMIT = 10;
 
 // 2. Define Platform-Specific Restrictions
 // This is where you enforce the "Shoes Only" rule for specific apps
 export const PLATFORM_RESTRICTIONS = {
  "goat": ["FOOTWEAR"], // Strictly shoes
  "stockx": ["FOOTWEAR", "APPAREL", "COLLECTIBLES"],
  "grailed": ["FOOTWEAR", "APPAREL"],
  "ebay": ["FOOTWEAR", "APPAREL", "ELECTRONICS", "COLLECTIBLES"], // Allows everything
  "shopify": ["FOOTWEAR", "APPAREL", "ELECTRONICS", "COLLECTIBLES"]
 } as const;
//
export { conversations, messages, insertConversationSchema, insertMessageSchema } from "./models/chat";
export type {
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
} from "./models/chat";

export const sessions = pgTable(
=======
 
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
>>>>>>> 2054f48
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
<<<<<<< HEAD
  (table) => [index("IDX_session_expire").on(table.expire)],
);
export const users = pgTable("users", {
=======
  (t) => [index("IDX_session_expire").on(t.expire)]
 );
 
 // --- USERS ---
 export const users = pgTable("users", {
>>>>>>> 2054f48
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
 
<<<<<<< HEAD
 // This creates the schema for inserts, but tells it to ignore 'id'
 // since the database (serial) generates it for us.
 export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
 });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  additionalImages: text("additional_images").array().notNull().default(sql`ARRAY[]::text[]`),
=======
 // --- PRODUCTS ---
 export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  additionalImages: text("additional_images").array(),
>>>>>>> 2054f48
  originalTitle: text("original_title").notNull(),
  aiDescription: text("ai_description").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
<<<<<<< HEAD
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

/** Known marketplace ids; listings accept any string for forward compatibility. */
export const marketplaces = [
  "ebay",
  "amazon",
  "mercari",
  "mercari-jp",
  "stockx",
  "grailed",
  "whatnot",
  "tcgplayer",
  "discogs",
  "poshmark",
  "gumtree",
  "etsy",
  "shopify",
  "woocommerce",
  "squarespace",
  "wix",
  "prestashop",
  "mercadolibre",
  "pinterest",
  "tiktokshop",
  "wallapop",
  "vinted",
  "shopee",
  "olx",
  "falabella",
  "bolcom",
] as const;
export type Marketplace = (typeof marketplaces)[number];

export const listings = pgTable("listings", {
=======
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
 });
 
 // --- LISTINGS ---
 export const listings = pgTable("listings", {
>>>>>>> 2054f48
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  marketplace: text("marketplace").notNull(),
  marketplaceListingId: text("marketplace_listing_id"),
  translatedTitle: text("translated_title").notNull(),
<<<<<<< HEAD
  translatedDescription: text("translated_description").notNull(),
  localPrice: decimal("local_price", { precision: 10, scale: 2 }).notNull(),
  localCurrency: text("local_currency").notNull(),
  status: text("status").notNull().default("pending"),
  ebayItemId: text("ebay_item_id"),
shopifyVariantId: text("shopify_variant_id"),
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
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(),
  saleCurrency: text("sale_currency").notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  ourFee: decimal("our_fee", { precision: 10, scale: 2 }).notNull(),
  feePaid: boolean("fee_paid").notNull().default(false),
  saleDate: timestamp("sale_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  buyerInfo: text("buyer_info"),
  shippingLabelGenerated: boolean("shipping_label_generated").notNull().default(false),
});

export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, saleDate: true });
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

export const marketplaceCredentials = pgTable("marketplace_credentials", {
  id: serial("id").primaryKey(),
  marketplace: text("marketplace").notNull().unique(),
  credentials: text("credentials").notNull(),
  connected: boolean("connected").notNull().default(false),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMarketplaceCredentialsSchema = createInsertSchema(marketplaceCredentials).omit({
  id: true,
  updatedAt: true,
});
export type MarketplaceCredentials = typeof marketplaceCredentials.$inferSelect;
export type InsertMarketplaceCredentials = z.infer<typeof insertMarketplaceCredentialsSchema>;

export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  trialStartedAt: timestamp("trial_started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
});

export type AppConfig = typeof appConfig.$inferSelect;

export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  layout: text("layout").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type InsertDashboardLayout = z.infer<typeof insertDashboardLayoutSchema>;
=======
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
>>>>>>> 2054f48
