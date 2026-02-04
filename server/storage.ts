import { db } from "./db";
import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  listings, type Listing, type InsertListing,
  sales, type Sale, type InsertSale,
  type Marketplace
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPin(id: string, pin: string): Promise<void>;
  getFirstUser(): Promise<User | undefined>;
  
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  deleteProduct(id: number): Promise<void>;
  
  createListing(listing: InsertListing): Promise<Listing>;
  getListingsByProduct(productId: number): Promise<Listing[]>;
  getAllListings(): Promise<Listing[]>;
  updateListingStatus(id: number, status: string, marketplaceListingId?: string): Promise<void>;
  deleteListingsByProduct(productId: number): Promise<void>;
  
  createSale(sale: InsertSale): Promise<Sale>;
  getSalesByListing(listingId: number): Promise<Sale[]>;
  getAllSales(): Promise<Sale[]>;
  updateSaleFeePaid(id: number, paid: boolean): Promise<void>;
}

export const storage: IStorage = {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },

  async createUser(insertUser: InsertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  },

  async updateUserPin(id: string, pin: string) {
    await db.update(users).set({ pin }).where(eq(users.id, id));
  },

  async getFirstUser() {
    const [user] = await db.select().from(users).limit(1);
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
};
