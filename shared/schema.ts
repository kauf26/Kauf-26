import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
 id: serial("id").primaryKey(),
 sub: text("sub").notNull().unique(),
 username: text("username").notNull().unique(),
 password: text("password").notNull(),
 email: text("email"),
 // --- 14-DAY TRIAL FIELDS ---
 trialStartDate: timestamp("trial_start_date").defaultNow().notNull(),
 isTrialActive: boolean("is_trial_active").default(true).notNull(),
});

export const products = pgTable("products", {
 id: serial("id").primaryKey(),
 name: text("name").notNull(),
 description: text("description"),
 category: text("category"),
 subcategory: text("subcategory").notNull(),
 basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
 currency: text("currency").notNull().default("USD"),
 quantity: integer("quantity").notNull().default(1),
 imageUrl: text("image_url"),
 additionalImages: text("additional_images").array(),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

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
 marketplaceListingId: text("marketplace_listing_id").notNull(),
 translatedTitle: text("translated_title").notNull(),
 translatedDescription: text("translated_description").notNull(),
 localPrice: decimal("local_price", { precision: 10, scale: 2 }).notNull(),
 localCurrency: text("local_currency").notNull(),
 status: text("status").notNull().default("pending"),
 ebayItemId: text("ebay_item_id"),
 shopifyVariantId: text("shopify_variant_id"),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
 updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const sales = pgTable("sales", {
 id: serial("id").primaryKey(),
 listingId: integer("listing_id")
   .notNull()
   .references(() => listings.id, { onDelete: "cascade" }),
 saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(),
 saleCurrency: text("sale_currency").notNull(),
 platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
 ourFee: decimal("our_fee", { precision: 10, scale: 2 }).notNull(),
 feePaid: boolean("fee_paid").notNull().default(false),
 saleDate: timestamp("sale_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
 buyerInfo: text("buyer_info"),
 shippingLabelGenerated: boolean("shipping_label_generated").notNull().default(false),
});

export const marketplaceCredentials = pgTable("marketplace_credentials", {
 id: serial("id").primaryKey(),
 marketplace: text("marketplace").notNull().unique(),
 credentials: text("credentials").notNull(),
 connected: boolean("connected").notNull().default(false),
 updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const dashboardLayouts = pgTable("dashboard_layouts", {
 id: serial("id").primaryKey(),
 userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
 layout: text("layout").notNull(),
 createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
 updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

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

export const marketplaceSettings = pgTable("marketplace_settings", {
 id: serial("id").primaryKey(),
 userId: integer("user_id").references(() => users.id),
 marketplace: text("marketplace").notNull(),
 settings: jsonb("settings").notNull(),
 updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
 id: serial("id").primaryKey(),
 userId: integer("user_id").references(() => users.id),
 action: text("action").notNull(),
 entityType: text("entity_type"),
 entityId: integer("entity_id"),
 details: jsonb("details"),
 createdAt: timestamp("created_at").defaultNow(),
});

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