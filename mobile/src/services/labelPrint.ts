import * as Print from 'expo-print';
import {
  buildShippingLabelHtml,
  type LabelAddress,
  type LabelPackageDetails,
} from '../../../shared/shippingLabelTemplate';

export type PrintLabelInput = {
  fromAddress: LabelAddress;
  toAddress: LabelAddress;
  packageDetails: LabelPackageDetails;
  carrier: string;
  service: string;
  trackingNumber: string;
  estimatedDelivery?: string;
  shipDate?: string;
};

/** Generate a 4×6 PDF via expo-print and open the system print dialog. */
export async function printShippingLabel(input: PrintLabelInput): Promise<void> {
  const html = buildShippingLabelHtml({
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    packageDetails: input.packageDetails,
    carrier: input.carrier,
    service: input.service,
    trackingNumber: input.trackingNumber,
    estimatedDelivery: input.estimatedDelivery,
    shipDate: input.shipDate ?? new Date().toLocaleDateString(),
  });

  await Print.printAsync({ html });
}

/** Print an existing label PDF by URL (falls back to HTML if URI print fails). */
export async function printShippingLabelPdfUri(
  pdfUrl: string,
  htmlFallback: PrintLabelInput
): Promise<void> {
  try {
    await Print.printAsync({ uri: pdfUrl });
  } catch {
    await printShippingLabel(htmlFallback);
  }
}
