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
  type RateQuoteInput,
} from "./services/shippingRatesService";
import { generateMockLabelPdf } from "./services/shippingLabelPdf";
import {
  getShippingRatesBlockReason,
  isShippingAddressComplete,
  isShippingWeightValid,
} from "../shared/shippingValidation";
import { sendShippingLabelEmail } from "./services/shippingEmailService";

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
    } = body;

    const defaultFrom = defaultFromAddress();
    const from = (fromAddress as AddressJson) ?? defaultFrom;
    const to = (toAddress as AddressJson) ?? {};
    const pkg = normalizeLabelPackage(body);
    const selectedService = String(
      service ?? rateId ?? "USPS Priority Mail"
    );

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
          fromAddress: from,
          toAddress: to,
          packageDetails: pkg,
          service: selectedService,
          trackingNumber: "1Z9999999999",
        });

        return res.status(201).json({
          label,
          trackingNumber: label.trackingNumber,
          labelPdfUrl: label.labelPdfUrl,
          labelUrl: label.labelPdfUrl,
          productTitle: saleRow.productTitle,
        });
      }
    }

    const pdf = await generateMockLabelPdf({
      fromAddress: from,
      toAddress: to,
      packageDetails: pkg,
      service: selectedService,
      trackingNumber: "1Z9999999999",
    });

    return res.status(201).json({
      trackingNumber: "1Z9999999999",
      labelPdfUrl: pdf.url,
      labelUrl: pdf.url,
      mockOnly: true,
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
