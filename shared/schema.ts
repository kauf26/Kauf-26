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
  decimal

 } from "drizzle-orm/pg-core";
 import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

//
export { conversations, messages, insertConversationSchema, insertMessageSchema } from "./models/chat";
export type {
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
} from "./models/chat";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  username: varchar("username").unique(), 
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  firstLoginAt: timestamp("first_login_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  dailyImageCount: integer("daily_image_count").default(0),
  weeklyViolationStrikes: integer("weekly_violation_strikes").default(0),
  lockoutExpiry: timestamp("lockout_expiry"),

  permanentBan: boolean("permanent_ban").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  additionalImages: text("additional_images").array().notNull().default(sql`ARRAY[]::text[]`),
  originalTitle: text("original_title").notNull(),
  aiDescription: text("ai_description").notNull(),
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
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
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
