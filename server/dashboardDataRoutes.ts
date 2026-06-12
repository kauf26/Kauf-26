import express from "express";
import { db } from "./db";
import {
  dashboardLayouts,
  listings,
  products,
  sales,
} from "../shared/schema";
import { fetchPublishedListings } from "./services/publishedListingsService";
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  type FulfillmentStatus,
  type PaymentStatus,
} from "../shared/saleStatus";
import type { SoldProductsResponse } from "../shared/soldProducts";
import { desc, eq, ne, or, sql } from "drizzle-orm";

const router = express.Router();

/** Sales that count as sold: payment completed or any fulfillment progress. */
const soldSalesFilter = or(
  eq(sales.paymentStatus, "completed"),
  ne(sales.fulfillmentStatus, "not_shipped")
);

function productThumbnail(
  imageUrl: string | null | undefined,
  additionalImages: string[] | null | undefined
): string | null {
  if (imageUrl?.trim()) return imageUrl.trim();
  const first = additionalImages?.find((url) => typeof url === "string" && url.trim());
  return first?.trim() ?? null;
}

function serializeSale(row: {
  id: number;
  listingId: number;
  saleAmount: unknown;
  saleCurrency: string;
  platformFee: unknown;
  ourFee: unknown;
  feePaid: boolean;
  saleDate: Date | string | null;
  buyerInfo: string | null;
  shippingLabelGenerated: boolean;
  shippingLabelCreated: boolean;
  paymentStatus: string;
  fulfillmentStatus: string;
  shippedAt: Date | string | null;
  deliveredAt: Date | string | null;
  acceptedAt: Date | string | null;
  marketplace?: string | null;
  productTitle?: string | null;
  productId?: number | null;
}) {
  return {
    id: row.id,
    listingId: row.listingId,
    saleAmount: String(row.saleAmount),
    saleCurrency: row.saleCurrency,
    platformFee: String(row.platformFee),
    ourFee: String(row.ourFee),
    feePaid: row.feePaid,
    saleDate: row.saleDate?.toString?.() ?? String(row.saleDate),
    buyerInfo: row.buyerInfo,
    shippingLabelGenerated: row.shippingLabelGenerated,
    shipping_label_created: row.shippingLabelCreated,
    shippingLabelCreated: row.shippingLabelCreated,
    paymentStatus: row.paymentStatus,
    payment_status: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    fulfillment_status: row.fulfillmentStatus,
    shippedAt: row.shippedAt?.toString?.() ?? row.shippedAt ?? null,
    shipped_at: row.shippedAt?.toString?.() ?? row.shippedAt ?? null,
    deliveredAt: row.deliveredAt?.toString?.() ?? row.deliveredAt ?? null,
    delivered_at: row.deliveredAt?.toString?.() ?? row.deliveredAt ?? null,
    acceptedAt: row.acceptedAt?.toString?.() ?? row.acceptedAt ?? null,
    accepted_at: row.acceptedAt?.toString?.() ?? row.acceptedAt ?? null,
    marketplace: row.marketplace,
    productTitle: row.productTitle,
    productId: row.productId,
  };
}

router.get("/listings", async (_req, res) => {
  try {
    const rows = await fetchPublishedListings();
    return res.status(200).json(rows);
  } catch (error) {
    console.error("[KAUF26] Error fetching listings:", error);
    return res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.get("/sales", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: sales.id,
        listingId: sales.listingId,
        saleAmount: sales.saleAmount,
        saleCurrency: sales.saleCurrency,
        platformFee: sales.platformFee,
        ourFee: sales.ourFee,
        feePaid: sales.feePaid,
        saleDate: sales.saleDate,
        buyerInfo: sales.buyerInfo,
        shippingLabelGenerated: sales.shippingLabelGenerated,
        shippingLabelCreated: sales.shippingLabelCreated,
        paymentStatus: sales.paymentStatus,
        fulfillmentStatus: sales.fulfillmentStatus,
        shippedAt: sales.shippedAt,
        deliveredAt: sales.deliveredAt,
        acceptedAt: sales.acceptedAt,
        marketplace: listings.marketplace,
        productTitle: products.name,
        productId: products.id,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .orderBy(desc(sales.saleDate));

    const payload = rows.map((row) => serializeSale(row));

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[KAUF26] Error fetching sales:", error);
    return res.status(500).json({ error: "Failed to fetch sales" });
  }
});

router.get("/sales/products", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countRow] = await db
      .select({
        total: sql<number>`cast(count(distinct ${products.id}) as int)`,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(soldSalesFilter);

    const rows = await db
      .select({
        id: products.id,
        title: products.name,
        imageUrl: products.imageUrl,
        additionalImages: products.additionalImages,
        totalQuantitySold: sql<number>`cast(count(${sales.id}) as int)`,
        totalRevenue: sql<string>`cast(coalesce(sum(${sales.saleAmount}), 0) as text)`,
        mostRecentSaleDate: sql<Date>`max(${sales.saleDate})`,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(soldSalesFilter)
      .groupBy(
        products.id,
        products.name,
        products.imageUrl,
        products.additionalImages
      )
      .orderBy(desc(sql`max(${sales.saleDate})`))
      .limit(limit)
      .offset(offset);

    const totalSoldProducts = Number(countRow?.total ?? 0);
    const payload: SoldProductsResponse = {
      totalSoldProducts: Number.isFinite(totalSoldProducts) ? totalSoldProducts : 0,
      products: rows.map((row) => ({
        id: row.id,
        title: row.title,
        thumbnail: productThumbnail(row.imageUrl, row.additionalImages),
        total_quantity_sold: Number(row.totalQuantitySold ?? 0),
        total_revenue: String(row.totalRevenue ?? "0"),
        most_recent_sale_date:
          row.mostRecentSaleDate?.toString?.() ?? String(row.mostRecentSaleDate ?? ""),
      })),
      page,
      limit,
      hasMore: offset + rows.length < totalSoldProducts,
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[KAUF26] Error fetching sold products:", error);
    return res.status(500).json({ error: "Failed to fetch sold products" });
  }
});

router.patch("/sales/:saleId/status", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!Number.isFinite(saleId)) {
      return res.status(400).json({ error: "Invalid sale id" });
    }

    const body = req.body ?? {};
    const paymentStatus = body.payment_status ?? body.paymentStatus;
    const fulfillmentStatus = body.fulfillment_status ?? body.fulfillmentStatus;

    if (paymentStatus == null && fulfillmentStatus == null) {
      return res.status(400).json({
        error: "Provide payment_status and/or fulfillment_status",
      });
    }

    const updates: Record<string, unknown> = {};

    if (paymentStatus != null) {
      if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
        return res.status(400).json({ error: "Invalid payment_status" });
      }
      updates.paymentStatus = paymentStatus;
    }

    if (fulfillmentStatus != null) {
      if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus as FulfillmentStatus)) {
        return res.status(400).json({ error: "Invalid fulfillment_status" });
      }
      updates.fulfillmentStatus = fulfillmentStatus;
      const now = new Date();
      if (fulfillmentStatus === "shipped") {
        updates.shippedAt = now;
      } else if (fulfillmentStatus === "delivered") {
        updates.deliveredAt = now;
      } else if (fulfillmentStatus === "accepted") {
        updates.acceptedAt = now;
      }
    }

    const [updated] = await db
      .update(sales)
      .set(updates)
      .where(eq(sales.id, saleId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const [enriched] = await db
      .select({
        id: sales.id,
        listingId: sales.listingId,
        saleAmount: sales.saleAmount,
        saleCurrency: sales.saleCurrency,
        platformFee: sales.platformFee,
        ourFee: sales.ourFee,
        feePaid: sales.feePaid,
        saleDate: sales.saleDate,
        buyerInfo: sales.buyerInfo,
        shippingLabelGenerated: sales.shippingLabelGenerated,
        shippingLabelCreated: sales.shippingLabelCreated,
        paymentStatus: sales.paymentStatus,
        fulfillmentStatus: sales.fulfillmentStatus,
        shippedAt: sales.shippedAt,
        deliveredAt: sales.deliveredAt,
        acceptedAt: sales.acceptedAt,
        marketplace: listings.marketplace,
        productTitle: products.name,
        productId: products.id,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(eq(sales.id, saleId));

    return res.status(200).json(serializeSale(enriched));
  } catch (error) {
    console.error("[KAUF26] Error updating sale status:", error);
    return res.status(500).json({ error: "Failed to update sale status" });
  }
});

router.post("/sales/:saleId/shipping-label-status", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!Number.isFinite(saleId)) {
      return res.status(400).json({ error: "Invalid sale id" });
    }

    const { created = true } = req.body ?? {};

    const [updated] = await db
      .update(sales)
      .set({
        shippingLabelCreated: Boolean(created),
        shippingLabelGenerated: Boolean(created),
      })
      .where(eq(sales.id, saleId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Sale not found" });
    }

    return res.status(200).json({
      id: updated.id,
      shipping_label_created: updated.shippingLabelCreated,
      shippingLabelCreated: updated.shippingLabelCreated,
    });
  } catch (error) {
    console.error("[KAUF26] Error updating shipping label status:", error);
    return res.status(500).json({ error: "Failed to update shipping label status" });
  }
});

router.post("/sales/:saleId/pay-fee", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!Number.isFinite(saleId)) {
      return res.status(400).json({ error: "Invalid sale id" });
    }

    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, saleId));

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    return res.status(200).json({
      url: `/sales?paid=${saleId}`,
      message: "Fee payment mock — configure Stripe for production",
    });
  } catch (error) {
    console.error("[KAUF26] Error creating pay-fee session:", error);
    return res.status(500).json({ error: "Failed to create payment session" });
  }
});

router.get("/dashboard/layout", async (_req, res) => {
  try {
    const [row] = await db
      .select({ layout: dashboardLayouts.layout })
      .from(dashboardLayouts)
      .orderBy(desc(dashboardLayouts.updatedAt))
      .limit(1);

    return res.status(200).json({ layout: row?.layout ?? null });
  } catch (error) {
    console.error("[KAUF26] Error fetching dashboard layout:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard layout" });
  }
});

router.post("/dashboard/layout", async (req, res) => {
  try {
    const layout =
      typeof req.body?.layout === "string"
        ? req.body.layout
        : JSON.stringify(req.body?.layout ?? {});

    const [saved] = await db
      .insert(dashboardLayouts)
      .values({ layout, userId: null })
      .returning({ layout: dashboardLayouts.layout });

    return res.status(200).json({ layout: saved.layout });
  } catch (error) {
    console.error("[KAUF26] Error saving dashboard layout:", error);
    return res.status(500).json({ error: "Failed to save dashboard layout" });
  }
});

export { router as dashboardDataRoutes };
