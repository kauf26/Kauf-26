import { db } from "../db";
import { sales, shippingLabels } from "../../shared/schema";
import { desc, eq } from "drizzle-orm";
import {
  ensureLabelsDir,
  generateMockLabelPdf,
  mockShippingRates,
  type AddressJson,
  type PackageDetailsJson,
} from "./shippingLabelPdf";

export {
  ensureLabelsDir,
  mockShippingRates,
  type AddressJson,
  type PackageDetailsJson,
};
export { LABELS_DIR } from "./shippingLabelPdf";

export async function createShippingLabelRecord(input: {
  saleId: number;
  userId?: number | null;
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
  service: string;
  trackingNumber?: string;
}): Promise<typeof shippingLabels.$inferSelect> {
  const trackingNumber = input.trackingNumber ?? "1Z9999999999";
  const pdf = await generateMockLabelPdf({
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    packageDetails: input.packageDetails,
    service: input.service,
    trackingNumber,
  });

  const [row] = await db
    .insert(shippingLabels)
    .values({
      saleId: input.saleId,
      userId: input.userId ?? null,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      packageDetails: input.packageDetails,
      service: input.service,
      trackingNumber,
      labelPdfUrl: pdf.url,
    })
    .returning();

  await db
    .update(sales)
    .set({ shippingLabelCreated: true, shippingLabelGenerated: true })
    .where(eq(sales.id, input.saleId));

  return row;
}

export async function listShippingLabels(userId?: number | null) {
  const rows = await db
    .select()
    .from(shippingLabels)
    .orderBy(desc(shippingLabels.createdAt));

  if (userId == null) return rows;
  return rows.filter((r) => r.userId == null || r.userId === userId);
}
