/**
 * Aggregates Depop marketplace metrics from listings, sales, publish tasks, and inventory.
 */
import { db } from "../db";
import {
  inventoryMarketplaceListings,
  inventorySyncEvents,
  listings,
  publishTasks,
  sales,
} from "../../shared/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { marketplaceEnvConfigured } from "./marketplaceCredentials";

const MARKETPLACE_ID = "depop";
const SALES_LOOKBACK_DAYS = 30;

export type DepopAnalyticsSummary = {
  totalListings: number;
  activeListings: number;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
  platformFees: number;
  avgSalePrice: number;
  publishSuccessRate: number;
  inventorySynced: number;
};

export type DepopAnalytics = {
  marketplaceId: typeof MARKETPLACE_ID;
  configured: boolean;
  partnershipStatus: "partnership-stub";
  generatedAt: string;
  summary: DepopAnalyticsSummary;
  listingsByStatus: Array<{ status: string; count: number }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
  publishTasksByStatus: Array<{ status: string; count: number }>;
  recentSales: Array<{
    id: number;
    saleAmount: string;
    saleCurrency: string;
    saleDate: string;
    listingTitle: string;
  }>;
  recentPublishTasks: Array<{
    id: number;
    status: string | null;
    errorMessage: string | null;
    updatedAt: string | null;
  }>;
  recentSyncEvents: Array<{
    id: number;
    eventType: string;
    message: string;
    createdAt: string | null;
  }>;
};

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildEmptySalesByDay(): Array<{ date: string; sales: number; revenue: number }> {
  const rows: Array<{ date: string; sales: number; revenue: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = SALES_LOOKBACK_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    rows.push({ date: formatDayKey(d), sales: 0, revenue: 0 });
  }
  return rows;
}

export async function getDepopAnalytics(): Promise<DepopAnalytics> {
  const configured = marketplaceEnvConfigured(MARKETPLACE_ID);
  const since = new Date();
  since.setDate(since.getDate() - SALES_LOOKBACK_DAYS);

  const depopListings = await db
    .select({
      id: listings.id,
      status: listings.status,
      translatedTitle: listings.translatedTitle,
      localPrice: listings.localPrice,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .where(eq(listings.marketplace, MARKETPLACE_ID));

  const listingsByStatusMap = new Map<string, number>();
  for (const row of depopListings) {
    const status = row.status || "unknown";
    listingsByStatusMap.set(status, (listingsByStatusMap.get(status) ?? 0) + 1);
  }

  const depopSales = await db
    .select({
      id: sales.id,
      saleAmount: sales.saleAmount,
      saleCurrency: sales.saleCurrency,
      platformFee: sales.platformFee,
      ourFee: sales.ourFee,
      saleDate: sales.saleDate,
      listingTitle: listings.translatedTitle,
    })
    .from(sales)
    .innerJoin(listings, eq(sales.listingId, listings.id))
    .where(eq(listings.marketplace, MARKETPLACE_ID))
    .orderBy(desc(sales.saleDate))
    .limit(200);

  const recentSalesRows = await db
    .select({
      id: sales.id,
      saleAmount: sales.saleAmount,
      saleCurrency: sales.saleCurrency,
      saleDate: sales.saleDate,
      listingTitle: listings.translatedTitle,
    })
    .from(sales)
    .innerJoin(listings, eq(sales.listingId, listings.id))
    .where(eq(listings.marketplace, MARKETPLACE_ID))
    .orderBy(desc(sales.saleDate))
    .limit(8);

  const publishTaskRows = await db
    .select({
      id: publishTasks.id,
      status: publishTasks.status,
      errorMessage: publishTasks.errorMessage,
      updatedAt: publishTasks.updatedAt,
    })
    .from(publishTasks)
    .where(eq(publishTasks.marketplaceId, MARKETPLACE_ID))
    .orderBy(desc(publishTasks.updatedAt))
    .limit(200);

  const publishByStatus = new Map<string, number>();
  for (const row of publishTaskRows) {
    const status = row.status || "unknown";
    publishByStatus.set(status, (publishByStatus.get(status) ?? 0) + 1);
  }

  const inventoryRows = await db
    .select({
      id: inventoryMarketplaceListings.id,
      status: inventoryMarketplaceListings.status,
    })
    .from(inventoryMarketplaceListings)
    .where(eq(inventoryMarketplaceListings.marketplaceId, MARKETPLACE_ID));

  const syncEventRows = await db
    .select({
      id: inventorySyncEvents.id,
      eventType: inventorySyncEvents.eventType,
      message: inventorySyncEvents.message,
      createdAt: inventorySyncEvents.createdAt,
    })
    .from(inventorySyncEvents)
    .where(
      and(
        eq(inventorySyncEvents.marketplaceId, MARKETPLACE_ID),
        gte(inventorySyncEvents.createdAt, since)
      )
    )
    .orderBy(desc(inventorySyncEvents.createdAt))
    .limit(10);

  const grossRevenue = depopSales.reduce(
    (sum, row) => sum + toNumber(row.saleAmount),
    0
  );
  const platformFees = depopSales.reduce(
    (sum, row) => sum + toNumber(row.platformFee),
    0
  );
  const ourFees = depopSales.reduce(
    (sum, row) => sum + toNumber(row.ourFee),
    0
  );
  const totalSales = depopSales.length;
  const activeListings = depopListings.filter((l) => l.status === "active").length;
  const completedPublishes = publishTaskRows.filter(
    (t) => t.status === "completed" || t.status === "success"
  ).length;
  const failedPublishes = publishTaskRows.filter(
    (t) => t.status === "failed" || t.status === "error"
  ).length;
  const publishAttempts = completedPublishes + failedPublishes;
  const publishSuccessRate =
    publishAttempts > 0 ? (completedPublishes / publishAttempts) * 100 : 0;

  const salesByDay = buildEmptySalesByDay();
  const salesByDayIndex = new Map(salesByDay.map((row, i) => [row.date, i]));

  for (const row of depopSales) {
    if (!row.saleDate) continue;
    const key = formatDayKey(new Date(row.saleDate));
    const idx = salesByDayIndex.get(key);
    if (idx == null) continue;
    salesByDay[idx]!.sales += 1;
    salesByDay[idx]!.revenue += toNumber(row.saleAmount);
  }

  return {
    marketplaceId: MARKETPLACE_ID,
    configured,
    partnershipStatus: "partnership-stub",
    generatedAt: new Date().toISOString(),
    summary: {
      totalListings: depopListings.length,
      activeListings,
      totalSales,
      grossRevenue,
      netRevenue: grossRevenue - platformFees - ourFees,
      platformFees,
      avgSalePrice: totalSales > 0 ? grossRevenue / totalSales : 0,
      publishSuccessRate,
      inventorySynced: inventoryRows.filter((r) => r.status === "active").length,
    },
    listingsByStatus: [...listingsByStatusMap.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    salesByDay,
    publishTasksByStatus: [...publishByStatus.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    recentSales: recentSalesRows.map((row) => ({
      id: row.id,
      saleAmount: String(row.saleAmount),
      saleCurrency: row.saleCurrency,
      saleDate: row.saleDate?.toISOString() ?? new Date().toISOString(),
      listingTitle: row.listingTitle,
    })),
    recentPublishTasks: publishTaskRows.slice(0, 8).map((row) => ({
      id: row.id,
      status: row.status,
      errorMessage: row.errorMessage,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    })),
    recentSyncEvents: syncEventRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      message: row.message,
      createdAt: row.createdAt?.toISOString() ?? null,
    })),
  };
}
