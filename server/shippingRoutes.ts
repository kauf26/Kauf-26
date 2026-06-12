import express from "express";
import { db } from "./db";
import { sales, listings, products, shippingLabels } from "../shared/schema";
import { desc, eq } from "drizzle-orm";
import {
  createShippingLabelRecord,
  listShippingLabels,
  type AddressJson,
  type PackageDetailsJson,
} from "./services/shippingLabelService";
import {
  defaultFromAddress,
  getShippingRates,
  type RateQuoteInput,
} from "./services/shippingRatesService";
import { generateMockLabelPdf } from "./services/shippingLabelPdf";
import {
  getShippingRatesBlockReason,
  isShippingAddressComplete,
  isShippingWeightValid,
} from "../shared/shippingValidation";
import { sendShippingLabelEmail } from "./services/shippingEmailService";
import { parseBuyerAddress } from "../shared/shippingAddresses";

const router = express.Router();

function normalizeRatesBody(body: Record<string, unknown>): RateQuoteInput {
  const dimensions = body.dimensions as Record<string, unknown> | undefined;

  if (body.packageDetails && typeof body.packageDetails === "object") {
    return {
      fromAddress: body.fromAddress as AddressJson | undefined,
      toAddress: body.toAddress as AddressJson | undefined,
      packageDetails: body.packageDetails as RateQuoteInput["packageDetails"],
      weightLbs: body.weightLbs as number | undefined,
      weightOz: body.weightOz as number | undefined,
    };
  }

  return {
    fromAddress: body.fromAddress as AddressJson | undefined,
    toAddress: body.toAddress as AddressJson | undefined,
    weightLbs: body.weightLbs as number | undefined,
    weightOz: body.weightOz as number | undefined,
    packageDetails: {
      weightLbs: Number(body.weightLbs ?? 1),
      weightOz: Number(body.weightOz ?? 0),
      lengthIn: Number(dimensions?.lengthIn ?? dimensions?.length ?? 10),
      widthIn: Number(dimensions?.widthIn ?? dimensions?.width ?? 10),
      heightIn: Number(dimensions?.heightIn ?? dimensions?.height ?? 10),
    },
  };
}

function normalizeLabelPackage(body: Record<string, unknown>): PackageDetailsJson {
  const packageDetails = (body.packageDetails ?? {}) as Record<string, unknown>;
  const dimensions = body.dimensions as Record<string, unknown> | undefined;

  return {
    weightLbs: Number(
      packageDetails.weightLbs ?? body.weightLbs ?? body.weight ?? 1
    ),
    lengthIn: Number(
      packageDetails.lengthIn ??
        dimensions?.lengthIn ??
        dimensions?.length ??
        10
    ),
    widthIn: Number(
      packageDetails.widthIn ?? dimensions?.widthIn ?? dimensions?.width ?? 10
    ),
    heightIn: Number(
      packageDetails.heightIn ??
        dimensions?.heightIn ??
        dimensions?.height ??
        10
    ),
  };
}

router.get("/sales/:saleId/label-context", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!Number.isFinite(saleId) || saleId <= 0) {
      return res.status(400).json({ error: "Invalid sale ID." });
    }

    const [saleRow] = await db
      .select({
        id: sales.id,
        buyerInfo: sales.buyerInfo,
        productTitle: products.name,
        marketplace: listings.platform,
      })
      .from(sales)
      .innerJoin(listings, eq(sales.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(eq(sales.id, saleId));

    if (!saleRow) {
      return res.status(404).json({ error: "Sale not found." });
    }

    const existing = await db
      .select({
        trackingNumber: shippingLabels.trackingNumber,
        labelPdfUrl: shippingLabels.labelPdfUrl,
        service: shippingLabels.service,
      })
      .from(shippingLabels)
      .where(eq(shippingLabels.saleId, saleId))
      .orderBy(desc(shippingLabels.createdAt))
      .limit(1);

    const fromAddress = defaultFromAddress();
    const toAddress = parseBuyerAddress(saleRow.buyerInfo);

    return res.status(200).json({
      saleId,
      productTitle: saleRow.productTitle,
      marketplace: saleRow.marketplace,
      buyerInfo: saleRow.buyerInfo,
      fromAddress,
      toAddress,
      defaultPackage: {
        weightLbs: 1,
        weightOz: 0,
        lengthIn: 10,
        widthIn: 10,
        heightIn: 10,
      },
      existingLabel: existing[0] ?? null,
    });
  } catch (error) {
    console.error("[KAUF26] Error loading sale label context:", error);
    return res.status(500).json({ error: "Failed to load sale label context" });
  }
});

router.post("/rates", async (req, res) => {
  try {
    const input = normalizeRatesBody(req.body ?? {});
    const fromAddress = (input.fromAddress ?? defaultFromAddress()) as AddressJson;
    const toAddress = (input.toAddress ?? {}) as AddressJson;
    const weightLbs = String(
      input.packageDetails?.weightLbs ?? input.weightLbs ?? 1
    );
    const weightOz = String(input.packageDetails?.weightOz ?? input.weightOz ?? 0);

    const blockReason = getShippingRatesBlockReason({
      fromAddress,
      toAddress,
      weightLbs,
      weightOz,
    });
    if (blockReason) {
      return res.status(400).json({ error: blockReason });
    }

    const result = await getShippingRates(input);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[KAUF26] Error fetching shipping rates:", error);
    return res.status(500).json({ error: "Failed to fetch shipping rates" });
  }
});

router.post("/label", async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      saleId,
      fromAddress,
      toAddress,
      service,
      rateId,
      carrier,
      estimatedDelivery,
      estimatedDeliveryDate,
      deliveryDate,
    } = body;

    const defaultFrom = defaultFromAddress();
    const from = (fromAddress as AddressJson) ?? defaultFrom;
    const to = (toAddress as AddressJson) ?? {};
    const pkg = normalizeLabelPackage(body);
    const selectedService = String(
      service ?? rateId ?? "USPS Priority Mail"
    );
    const selectedCarrier = String(carrier ?? "").trim();
    const estDelivery = String(
      estimatedDelivery ?? estimatedDeliveryDate ?? deliveryDate ?? ""
    ).trim();

    if (!isShippingAddressComplete(from) || !isShippingAddressComplete(to)) {
      return res.status(400).json({
        error:
          "Complete ship-from and ship-to addresses (street, city, state, ZIP).",
      });
    }

    if (!isShippingWeightValid(pkg.weightLbs ?? 1)) {
      return res.status(400).json({ error: "Package weight must be greater than 0." });
    }

    const parsedSaleId = Number(saleId);
    const hasSaleId = Number.isFinite(parsedSaleId) && parsedSaleId > 0;

    const labelInput = {
      fromAddress: from,
      toAddress: to,
      packageDetails: pkg,
      carrier: selectedCarrier || undefined,
      service: selectedService,
      estimatedDelivery: estDelivery || undefined,
      shipDate: new Date().toLocaleDateString(),
    };

    if (hasSaleId) {
      const [saleRow] = await db
        .select({
          id: sales.id,
          productTitle: products.name,
        })
        .from(sales)
        .innerJoin(listings, eq(sales.listingId, listings.id))
        .innerJoin(products, eq(listings.productId, products.id))
        .where(eq(sales.id, parsedSaleId));

      if (saleRow) {
        const label = await createShippingLabelRecord({
          saleId: parsedSaleId,
          ...labelInput,
        });

        return res.status(201).json({
          label,
          trackingNumber: label.trackingNumber,
          labelPdfUrl: label.labelPdfUrl,
          labelUrl: label.labelPdfUrl,
          fromAddress: from,
          toAddress: to,
          carrier: selectedCarrier || null,
          service: selectedService,
          estimatedDelivery: estDelivery || null,
          productTitle: saleRow.productTitle,
        });
      }
    }

    const pdf = await generateMockLabelPdf(labelInput);

    return res.status(201).json({
      trackingNumber: pdf.trackingNumber,
      labelPdfUrl: pdf.url,
      labelUrl: pdf.url,
      fromAddress: from,
      toAddress: to,
      carrier: selectedCarrier || null,
      service: selectedService,
      estimatedDelivery: estDelivery || null,
      mockOnly: true,
    });
  } catch (error) {
    console.error("[KAUF26] Error generating shipping label:", error);
    return res.status(500).json({ error: "Failed to generate shipping label" });
  }
});

router.post("/label/preview-html", async (req, res) => {
  try {
    const body = req.body ?? {};
    const from = (body.fromAddress as AddressJson) ?? defaultFromAddress();
    const to = (body.toAddress as AddressJson) ?? {};
    const pkg = normalizeLabelPackage(body);
    const service = String(body.service ?? "USPS Priority Mail");
    const carrier = String(body.carrier ?? "").trim();
    const trackingNumber = String(body.trackingNumber ?? "").trim();
    const estimatedDelivery = String(
      body.estimatedDelivery ?? body.estimatedDeliveryDate ?? body.deliveryDate ?? ""
    ).trim();

    const { generateLabelHtml } = await import("./services/shippingLabelPdf");
    const html = generateLabelHtml({
      fromAddress: from,
      toAddress: to,
      packageDetails: pkg,
      carrier: carrier || undefined,
      service,
      trackingNumber: trackingNumber || undefined,
      estimatedDelivery: estimatedDelivery || undefined,
      shipDate: new Date().toLocaleDateString(),
    });

    return res.status(200).json({ html });
  } catch (error) {
    console.error("[KAUF26] Error building label HTML:", error);
    return res.status(500).json({ error: "Failed to build label preview" });
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

router.post("/label/email", async (req, res) => {
  try {
    const { email, labelUrl, labelPdfUrl, trackingNumber } = req.body ?? {};
    const url = String(labelPdfUrl ?? labelUrl ?? "").trim();
    if (!url) {
      return res.status(400).json({ error: "labelUrl is required." });
    }
    const result = await sendShippingLabelEmail({
      email: String(email ?? ""),
      labelUrl: url,
      trackingNumber: String(trackingNumber ?? "1Z9999999999"),
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("[KAUF26] Error emailing shipping label:", message);
    return res.status(400).json({ error: message });
  }
});

export { router as shippingRoutes };
