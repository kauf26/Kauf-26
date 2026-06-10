import express from "express";
import { db } from "./db";
import { sales, listings, products } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  createShippingLabelRecord,
  listShippingLabels,
  type AddressJson,
  type PackageDetailsJson,
} from "./services/shippingLabelService";
import {
  defaultFromAddress,
  getShippingRates,
} from "./services/shippingRatesService";

const router = express.Router();

router.post("/rates", async (req, res) => {
  try {
    const {
      fromAddress,
      toAddress,
      packageDetails,
      weightLbs,
      weightOz,
    } = req.body ?? {};

    const result = await getShippingRates({
      fromAddress: fromAddress as AddressJson | undefined,
      toAddress: toAddress as AddressJson | undefined,
      packageDetails: packageDetails as PackageDetailsJson | undefined,
      weightLbs,
      weightOz,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[KAUF26] Error fetching shipping rates:", error);
    return res.status(500).json({ error: "Failed to fetch shipping rates" });
  }
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

    const defaultFrom = defaultFromAddress();

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
