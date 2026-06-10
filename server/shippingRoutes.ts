import express from "express";
import { db } from "./db";
import { sales, listings, products } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  createShippingLabelRecord,
  listShippingLabels,
  mockShippingRates,
  type AddressJson,
  type PackageDetailsJson,
} from "./services/shippingLabelService";

const router = express.Router();

router.post("/rates", (req, res) => {
  const weightLbs = Number(req.body?.weightLbs ?? req.body?.weight ?? 1);
  const weight = Number.isFinite(weightLbs) && weightLbs > 0 ? weightLbs : 1;
  return res.status(200).json({ rates: mockShippingRates(weight) });
});

router.post("/label", async (req, res) => {
  try {
    const {
      saleId,
      fromAddress,
      toAddress,
      packageDetails,
      service,
    } = req.body ?? {};

    const parsedSaleId = Number(saleId);
    if (!Number.isFinite(parsedSaleId)) {
      return res.status(400).json({ error: "saleId is required" });
    }

    const [saleRow] = await db
      .select({
        id: sales.id,
        productTitle: products.name,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(eq(sales.id, parsedSaleId));

    if (!saleRow) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const defaultFrom: AddressJson = {
      name: process.env.SHIPPING_FROM_NAME ?? "KAUF26 Seller",
      line1: process.env.SHIPPING_FROM_LINE1 ?? "123 Warehouse Rd",
      city: process.env.SHIPPING_FROM_CITY ?? "Los Angeles",
      state: process.env.SHIPPING_FROM_STATE ?? "CA",
      postalCode: process.env.SHIPPING_FROM_ZIP ?? "90001",
      country: "US",
    };

    const pkg: PackageDetailsJson = {
      weightLbs: Number(packageDetails?.weightLbs ?? packageDetails?.weight ?? 1),
      lengthIn: Number(packageDetails?.lengthIn ?? packageDetails?.length ?? 10),
      widthIn: Number(packageDetails?.widthIn ?? packageDetails?.width ?? 10),
      heightIn: Number(packageDetails?.heightIn ?? packageDetails?.height ?? 10),
    };

    const label = await createShippingLabelRecord({
      saleId: parsedSaleId,
      fromAddress: (fromAddress as AddressJson) ?? defaultFrom,
      toAddress: (toAddress as AddressJson) ?? {},
      packageDetails: pkg,
      service: String(service ?? "USPS Priority Mail"),
      trackingNumber: "1Z9999999999",
    });

    return res.status(201).json({
      label,
      trackingNumber: label.trackingNumber,
      labelPdfUrl: label.labelPdfUrl,
      productTitle: saleRow.productTitle,
    });
  } catch (error) {
    console.error("[KAUF26] Error generating shipping label:", error);
    return res.status(500).json({ error: "Failed to generate shipping label" });
  }
});

router.get("/labels", async (_req, res) => {
  try {
    const labels = await listShippingLabels(null);
    return res.status(200).json({ labels });
  } catch (error) {
    console.error("[KAUF26] Error listing shipping labels:", error);
    return res.status(500).json({ error: "Failed to list shipping labels" });
  }
});

export { router as shippingRoutes };
