import { pgTable, pgEnum, serial, timestamp, text, numeric, integer, unique, boolean, foreignKey, varchar, index, jsonb } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const pricingType = pgEnum("pricing_type", ['recurring', 'one_time'])
export const pricingTiers = pgEnum("pricing_tiers", ['volume', 'graduated'])
export const subscriptionStatus = pgEnum("subscription_status", ['paused', 'unpaid', 'past_due', 'incomplete_expired', 'incomplete', 'canceled', 'active', 'trialing'])
export const invoiceStatus = pgEnum("invoice_status", ['deleted', 'void', 'uncollectible', 'paid', 'open', 'draft'])
export const subscriptionScheduleStatus = pgEnum("subscription_schedule_status", ['canceled', 'released', 'completed', 'active', 'not_started'])


export const appConfig = pgTable("app_config", {
	id: serial("id").primaryKey().notNull(),
	trialStartedAt: timestamp("trial_started_at", { mode: 'string' }).defaultNow().notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	subscriptionStatus: text("subscription_status").default('trial').notNull(),
});

export const products = pgTable("products", {
	id: serial("id").primaryKey().notNull(),
	imageUrl: text("image_url").notNull(),
	additionalImages: text("additional_images").default('RRAY[').array().notNull(),
	originalTitle: text("original_title").notNull(),
	aiDescription: text("ai_description").notNull(),
	basePrice: numeric("base_price", { precision: 10, scale:  2 }).notNull(),
	currency: text("currency").default('USD').notNull(),
	quantity: integer("quantity").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	userId: integer("user_id").notNull(),
	category: text("category").notNull(),
	subcategory: text("subcategory").notNull(),
});

export const conversations = pgTable("conversations", {
	id: serial("id").primaryKey().notNull(),
	title: text("title").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const marketplaceCredentials = pgTable("marketplace_credentials", {
	id: serial("id").primaryKey().notNull(),
	marketplace: text("marketplace").notNull(),
	credentials: text("credentials").notNull(),
	connected: boolean("connected").default(false).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		marketplaceCredentialsMarketplaceUnique: unique("marketplace_credentials_marketplace_unique").on(table.marketplace),
	}
});

export const messages = pgTable("messages", {
	id: serial("id").primaryKey().notNull(),
	conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" } ),
	role: text("role").notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const dashboardLayouts = pgTable("dashboard_layouts", {
	id: serial("id").primaryKey().notNull(),
	userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" } ),
	layout: text("layout").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
	sid: varchar("sid").primaryKey().notNull(),
	sess: jsonb("sess").notNull(),
	expire: timestamp("expire", { mode: 'string' }).notNull(),
},
(table) => {
	return {
		idxSessionExpire: index("IDX_session_expire").on(table.expire),
	}
});

export const sales = pgTable("sales", {
	id: serial("id").primaryKey().notNull(),
	listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" } ),
	saleAmount: numeric("sale_amount", { precision: 10, scale:  2 }).notNull(),
	saleCurrency: text("sale_currency").notNull(),
	platformFee: numeric("platform_fee", { precision: 10, scale:  2 }).default('0').notNull(),
	ourFee: numeric("our_fee", { precision: 10, scale:  2 }).notNull(),
	feePaid: boolean("fee_paid").default(false).notNull(),
	saleDate: timestamp("sale_date", { mode: 'string' }).defaultNow().notNull(),
	buyerInfo: text("buyer_info"),
	shippingLabelGenerated: boolean("shipping_label_generated").default(false).notNull(),
});

export const listings = pgTable("listings", {
	id: serial("id").primaryKey().notNull(),
	productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" } ),
	marketplace: text("marketplace").notNull(),
	marketplaceListingId: text("marketplace_listing_id"),
	translatedTitle: text("translated_title").notNull(),
	translatedDescription: text("translated_description").notNull(),
	localPrice: numeric("local_price", { precision: 10, scale:  2 }).notNull(),
	localCurrency: text("local_currency").notNull(),
	status: text("status").default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: varchar("id").primaryKey().notNull(),
	email: varchar("email"),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	firstLoginAt: timestamp("first_login_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	dailyImageCount: integer("daily_image_count").default(0),
	weeklyViolationStrikes: integer("weekly_violation_strikes").default(0),
	lockoutExpiry: timestamp("lockout_expiry", { mode: 'string' }),
	permanentBan: boolean("permanent_ban").default(false),
	username: varchar("username"),
},
(table) => {
	return {
		usersEmailUnique: unique("users_email_unique").on(table.email),
		usersUsernameUnique: unique("users_username_unique").on(table.username),
	}
});