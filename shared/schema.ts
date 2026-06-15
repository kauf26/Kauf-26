import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
id: serial("id").primaryKey(),
sub: text("sub").notNull().unique(),
username: text("username").notNull().unique(),
password: text("password").notNull(),
email: text("email"),
oauthProvider: text("oauth_provider"),
firstName: text("first_name"),
lastName: text("last_name"),
profileImageUrl: text("profile_image_url"),
onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
// --- 14-DAY TRIAL FIELDS ---
trialStartDate: timestamp("trial_start_date").defaultNow().notNull(),
isTrialActive: boolean("is_trial_active").default(true).notNull(),
trialStartedAt: timestamp("trial_started_at").defaultNow().notNull(),
dailyImageCount: integer("daily_image_count").default(0).notNull(),
lastImageResetAt: timestamp("last_image_reset_at").defaultNow().notNull(),
});

/** Encrypted Playwright storageState per user + marketplace (browser auth sessions). */
export const userMarketplaceSessions = pgTable(
  "user_marketplace_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    marketplaceId: text("marketplace_id").notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("user_marketplace_sessions_user_marketplace_unique").on(
      table.userId,
      table.marketplaceId
    ),
  ]
);

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
  "aliexpress",
  "allegro",
  "amazon",
  "bigcommerce",
  "bolcom",
  "depop",
  "ebay",
  "etsy",
  "flipkart",
  "fruugo",
  "lazada",
  "magento",
  "mercadolibre",
  "mercadolibre_br",
  "newegg",
  "poshmark",
  "rakuten",
  "shopee",
  "shopify",
  "stockx",
  "taobao",
  "tiktokshop",
  "vinted",
  "wayfair",
  "woocommerce",
  "zalando",
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
shippingLabelCreated: boolean("shipping_label_created").notNull().default(false),
paymentStatus: text("payment_status").notNull().default("pending"),
fulfillmentStatus: text("fulfillment_status").notNull().default("not_shipped"),
shippedAt: timestamp("shipped_at"),
deliveredAt: timestamp("delivered_at"),
acceptedAt: timestamp("accepted_at"),
});

export const shippingLabels = pgTable("shipping_labels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  fromAddress: jsonb("from_address").notNull().default({}),
  toAddress: jsonb("to_address").notNull().default({}),
  packageDetails: jsonb("package_details").notNull().default({}),
  service: text("service").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  labelPdfUrl: text("label_pdf_url").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const marketplaceCredentials = pgTable("marketplace_credentials", {
id: serial("id").primaryKey(),
marketplace: text("marketplace").notNull().unique(),
credentials: text("credentials").notNull(),
connected: boolean("connected").notNull().default(false),
updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

/** @deprecated OAuth tokens are not stored server-side. Metadata-only legacy table. */
export const marketplaceAuth = pgTable(
  "marketplace_auth",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    marketplace: text("marketplace").notNull(),
    shopDomain: text("shop_domain"),
    accountLabel: text("account_label"),
    connected: boolean("connected").notNull().default(true),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("marketplace_auth_user_marketplace_unique").on(
      table.userId,
      table.marketplace
    ),
  ]
);

/** @deprecated OAuth tokens are not stored server-side. Metadata-only legacy table. */
export const marketplaceConnections = pgTable(
  "marketplace_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    scope: text("scope"),
    marketplaceShopId: text("marketplace_shop_id"),
    shopDomain: text("shop_domain"),
    accountLabel: text("account_label"),
    connected: boolean("connected").notNull().default(true),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("marketplace_connections_user_provider_unique").on(
      table.userId,
      table.provider
    ),
  ]
);

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

export const publishJobs = pgTable("publish_jobs", {
 id: serial("id").primaryKey(),
 productData: jsonb("product_data").notNull(),
 createdAt: timestamp("created_at").defaultNow(),
});

export const publishTasks = pgTable("publish_tasks", {
 id: serial("id").primaryKey(),
 jobId: integer("job_id").references(() => publishJobs.id, { onDelete: "cascade" }),
 marketplaceId: text("marketplace_id").notNull(),
 status: text("status").default("pending"),
 attempts: integer("attempts").default(0),
 errorMessage: text("error_message"),
 updatedAt: timestamp("updated_at").defaultNow(),
});

// New table home for transient cross-border product drafts
export const productDrafts = pgTable("product_drafts", {
 id: serial("id").primaryKey(),
 userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
 title: text("title").notNull(),
 sku: text("sku"),
 status: text("status").default("draft"),
 images: text("images").array(),
 attributes: jsonb("attributes").default({}),
 createdAt: timestamp("created_at").defaultNow(),
 updatedAt: timestamp("updated_at").defaultNow(),
});

/** Central shared quantity for a draft across all marketplace listings */
export const inventoryPools = pgTable("inventory_pools", {
 id: serial("id").primaryKey(),
 draftId: integer("draft_id")
   .notNull()
   .references(() => productDrafts.id, { onDelete: "cascade" })
   .unique(),
 quantity: integer("quantity").notNull().default(1),
 version: integer("version").notNull().default(0),
 status: text("status").notNull().default("active"),
 sku: text("sku"),
 createdAt: timestamp("created_at").defaultNow(),
 updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventoryMarketplaceListings = pgTable(
 "inventory_marketplace_listings",
 {
   id: serial("id").primaryKey(),
   poolId: integer("pool_id")
     .notNull()
     .references(() => inventoryPools.id, { onDelete: "cascade" }),
   marketplaceId: text("marketplace_id").notNull(),
   listingId: text("listing_id"),
   sku: text("sku"),
   status: text("status").notNull().default("active"),
   lastSyncedQuantity: integer("last_synced_quantity"),
   updatedAt: timestamp("updated_at").defaultNow(),
 }
);

export const inventorySyncEvents = pgTable("inventory_sync_events", {
 id: serial("id").primaryKey(),
 poolId: integer("pool_id")
   .notNull()
   .references(() => inventoryPools.id, { onDelete: "cascade" }),
 eventType: text("event_type").notNull(),
 marketplaceId: text("marketplace_id"),
 message: text("message").notNull(),
 quantityBefore: integer("quantity_before"),
 quantityAfter: integer("quantity_after"),
 metadata: jsonb("metadata"),
 createdAt: timestamp("created_at").defaultNow(),
});

/** Idempotency: one decrement per marketplace order */
export const inventorySaleDedup = pgTable(
 "inventory_sale_dedup",
 {
   id: serial("id").primaryKey(),
   poolId: integer("pool_id")
     .notNull()
     .references(() => inventoryPools.id, { onDelete: "cascade" }),
   marketplaceId: text("marketplace_id").notNull(),
   externalOrderId: text("external_order_id").notNull(),
   createdAt: timestamp("created_at").defaultNow(),
 },
 (table) => [
   uniqueIndex("inventory_sale_dedup_order_unique").on(
     table.poolId,
     table.marketplaceId,
     table.externalOrderId
   ),
 ]
);

// --- SCHEMAS & TYPES ---
export const insertUserSchema = createInsertSchema(users);
export const insertProductSchema = createInsertSchema(products);
export const insertListingSchema = createInsertSchema(listings);
export const insertCatalogItemSchema = createInsertSchema(catalogItems);
export const insertMarketplaceSettingsSchema = createInsertSchema(marketplaceSettings);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const insertProductDraftSchema = createInsertSchema(productDrafts);

export type User = typeof users.$inferSelect;
export type UserMarketplaceSession = typeof userMarketplaceSessions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type CatalogItem = typeof catalogItems.$inferSelect;
export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;
export type MarketplaceSettings = typeof marketplaceSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ProductDraft = typeof productDrafts.$inferSelect;
export type InsertProductDraft = z.infer<typeof insertProductDraftSchema>;
export type Sale = typeof sales.$inferSelect;
export type ShippingLabel = typeof shippingLabels.$inferSelect;
export type InventoryPool = typeof inventoryPools.$inferSelect;
export type InventoryMarketplaceListing =
 typeof inventoryMarketplaceListings.$inferSelect;
export type InventorySyncEvent = typeof inventorySyncEvents.$inferSelect;
