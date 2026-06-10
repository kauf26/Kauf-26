import express from "express";
import { db } from "./db";
import {
  dashboardLayouts,
  listings,
  products,
  sales,
} from "../shared/schema";
import { desc, eq } from "drizzle-orm";

const router = express.Router();

router.get("/listings", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: listings.id,
        marketplace: listings.marketplace,
        status: listings.status,
        productId: listings.productId,
        translatedTitle: listings.translatedTitle,
      })
      .from(listings)
      .orderBy(desc(listings.createdAt));

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
        marketplace: listings.marketplace,
        productTitle: products.name,
        productId: products.id,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .orderBy(desc(sales.saleDate));

    const payload = rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      saleAmount: String(row.saleAmount),
      saleCurrency: row.saleCurrency,
      platformFee: String(row.platformFee),
      ourFee: String(row.ourFee),
      feePaid: row.feePaid,
      saleDate: row.saleDate?.toISOString?.() ?? String(row.saleDate),
      buyerInfo: row.buyerInfo,
      shippingLabelGenerated: row.shippingLabelGenerated,
      shipping_label_created: row.shippingLabelCreated,
      shippingLabelCreated: row.shippingLabelCreated,
      marketplace: row.marketplace,
      productTitle: row.productTitle,
      productId: row.productId,
    }));

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[KAUF26] Error fetching sales:", error);
    return res.status(500).json({ error: "Failed to fetch sales" });
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
