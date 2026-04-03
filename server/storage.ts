import { db } from "./db";
import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  listings, type Listing, type InsertListing,
  sales, type Sale, type InsertSale,
  dashboardLayouts, type DashboardLayout,
  appConfig, type AppConfig,
  marketplaceCredentials, type MarketplaceCredentials,
  type Marketplace
} from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  deleteProduct(id: number): Promise<void>;
  updateProductQuantity(id: number, quantity: number): Promise<void>;
  
  createListing(listing: InsertListing): Promise<Listing>;
  getListingsByProduct(productId: number): Promise<Listing[]>;
  getAllListings(): Promise<Listing[]>;
  updateListingStatus(id: number, status: string, marketplaceListingId?: string): Promise<void>;
  deleteListingsByProduct(productId: number): Promise<void>;
  
  createSale(sale: InsertSale): Promise<Sale>;
  getSalesByListing(listingId: number): Promise<Sale[]>;
  getAllSales(): Promise<Sale[]>;
  updateSaleFeePaid(id: number, paid: boolean): Promise<void>;
  
  getDashboardLayout(userId?: string): Promise<DashboardLayout | undefined>;
  saveDashboardLayout(userId: string | null, layout: string): Promise<DashboardLayout>;

  getAppConfig(): Promise<AppConfig | undefined>;
  initAppConfig(): Promise<AppConfig>;
  updateSubscription(stripeCustomerId: string, stripeSubscriptionId: string, status: string): Promise<void>;

  getAllMarketplaceCredentials(): Promise<MarketplaceCredentials[]>;
  upsertMarketplaceCredentials(marketplace: string, credentials: string): Promise<MarketplaceCredentials>;
  deleteMarketplaceCredentials(marketplace: string): Promise<void>;
}

export const storage: IStorage = {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async createProduct(product: InsertProduct) {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  },

  async getProduct(id: number) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  },

  async getAllProducts() {
    return db.select().from(products).orderBy(desc(products.createdAt));
  },

  async deleteProduct(id: number) {
    await db.delete(products).where(eq(products.id, id));
  },

  async updateProductQuantity(id: number, quantity: number) {
    await db.update(products).set({ quantity }).where(eq(products.id, id));
  },

  async createListing(listing: InsertListing) {
    const [created] = await db.insert(listings).values(listing).returning();
    return created;
  },

  async getListingsByProduct(productId: number) {
    return db.select().from(listings).where(eq(listings.productId, productId));
  },

  async getAllListings() {
    return db.select().from(listings).orderBy(desc(listings.createdAt));
  },

  async updateListingStatus(id: number, status: string, marketplaceListingId?: string) {
    await db.update(listings)
      .set({ 
        status, 
        ...(marketplaceListingId && { marketplaceListingId }),
        updatedAt: new Date()
      })
      .where(eq(listings.id, id));
  },

  async deleteListingsByProduct(productId: number) {
    await db.delete(listings).where(eq(listings.productId, productId));
  },

  async createSale(sale: InsertSale) {
    const [created] = await db.insert(sales).values(sale).returning();
    return created;
  },

  async getSalesByListing(listingId: number) {
    return db.select().from(sales).where(eq(sales.listingId, listingId));
  },

  async getAllSales() {
    return db.select().from(sales).orderBy(desc(sales.saleDate));
  },

  async updateSaleFeePaid(id: number, paid: boolean) {
    await db.update(sales).set({ feePaid: paid }).where(eq(sales.id, id));
  },

  async getDashboardLayout(userId?: string) {
    if (userId) {
      const [layout] = await db.select().from(dashboardLayouts).where(eq(dashboardLayouts.userId, userId));
      return layout;
    }
    const [layout] = await db.select().from(dashboardLayouts).where(isNull(dashboardLayouts.userId));
    return layout;
  },

  async saveDashboardLayout(userId: string | null, layout: string) {
    const existing = await this.getDashboardLayout(userId || undefined);
    if (existing) {
      const [updated] = await db.update(dashboardLayouts)
        .set({ layout, updatedAt: new Date() })
        .where(eq(dashboardLayouts.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(dashboardLayouts)
      .values({ userId, layout })
      .returning();
    return created;
  },

  async getAppConfig() {
    const [config] = await db.select().from(appConfig).limit(1);
    return config;
  },

  async initAppConfig() {
    const existing = await this.getAppConfig();
    if (existing) return existing;
    const [created] = await db.insert(appConfig).values({}).returning();
    return created;
  },

  async updateSubscription(stripeCustomerId: string, stripeSubscriptionId: string, status: string) {
    const existing = await this.getAppConfig();
    if (existing) {
      await db.update(appConfig)
        .set({ stripeCustomerId, stripeSubscriptionId, subscriptionStatus: status })
        .where(eq(appConfig.id, existing.id));
    }
  },

  async getAllMarketplaceCredentials() {
    return db.select().from(marketplaceCredentials);
  },

  async upsertMarketplaceCredentials(marketplace: string, credentials: string) {
    const existing = await db.select().from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, marketplace)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(marketplaceCredentials)
        .set({ credentials, connected: true, updatedAt: new Date() })
        .where(eq(marketplaceCredentials.marketplace, marketplace))
        .returning();
      return updated;
    }
    const [created] = await db.insert(marketplaceCredentials)
      .values({ marketplace, credentials, connected: true })
      .returning();
    return created;
  },

  async deleteMarketplaceCredentials(marketplace: string) {
    await db.delete(marketplaceCredentials).where(eq(marketplaceCredentials.marketplace, marketplace));
  },
};
