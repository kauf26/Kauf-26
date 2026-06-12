import fs from "fs/promises";
import path from "path";
import {
  buildShippingLabelHtml,
  formatAddressLines,
  formatCarrierService,
  generateMockTrackingNumber,
  type LabelAddress,
  type LabelPackageDetails,
  type ShippingLabelContent,
} from "../../shared/shippingLabelTemplate";
import { UPLOADS_DIR } from "./draftPhotoUpload";

export const LABELS_DIR = path.join(UPLOADS_DIR, "labels");

export type AddressJson = LabelAddress;
export type PackageDetailsJson = LabelPackageDetails;

export async function ensureLabelsDir(): Promise<void> {
  await fs.mkdir(LABELS_DIR, { recursive: true });
}

export function publicLabelUrl(filename: string): string {
  return `/uploads/labels/${filename}`;
}

export { mockShippingRates } from "./shippingRatesService";
export { buildShippingLabelHtml, formatAddressLines, generateMockTrackingNumber };

/** 4×6 in at 72 dpi */
const PAGE_W = 288;
const PAGE_H = 432;

type PdfText = {
  text: string;
  x: number;
  y: number;
  size?: number;
  bold?: boolean;
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function trackingToBars(tracking: string): Array<{ x: number; w: number }> {
  let x = 0;
  const bars: Array<{ x: number; w: number }> = [];
  for (const ch of tracking) {
    const w = (ch.charCodeAt(0) % 3) + 1;
    bars.push({ x, w });
    x += w + 1;
  }
  return bars;
}

function buildLabelPdf(content: ShippingLabelContent): Buffer {
  const texts: PdfText[] = [];
  const margin = 14;
  let y = PAGE_H - margin;

  const carrierLine = formatCarrierService(content.carrier, content.service);
  texts.push({ text: carrierLine, x: margin, y, size: 12, bold: true });
  y -= 14;

  const shipDate = content.shipDate?.trim() || new Date().toLocaleDateString();
  const estDelivery = content.estimatedDelivery?.trim() || "See carrier tracking";
  texts.push({
    text: `Ship: ${shipDate}  ·  Est. delivery: ${estDelivery}`,
    x: margin,
    y,
    size: 8,
  });
  y -= 16;

  texts.push({ text: "SHIP TO", x: margin, y, size: 8, bold: true });
  y -= 12;

  const toLines = formatAddressLines(content.toAddress);
  toLines.forEach((line, index) => {
    texts.push({
      text: line,
      x: margin,
      y,
      size: index === 0 ? 13 : 11,
      bold: index === 0,
    });
    y -= index === 0 ? 16 : 13;
  });

  y -= 8;
  texts.push({ text: "FROM / RETURN", x: margin, y, size: 8, bold: true });
  y -= 11;

  formatAddressLines(content.fromAddress).forEach((line) => {
    texts.push({ text: line, x: margin, y, size: 8 });
    y -= 10;
  });

  y -= 6;
  const weight = content.packageDetails.weightLbs ?? 1;
  const dims = `${content.packageDetails.lengthIn ?? 10}x${content.packageDetails.widthIn ?? 10}x${content.packageDetails.heightIn ?? 10} in`;
  texts.push({ text: `Weight: ${weight} lb  ·  Dims: ${dims}`, x: margin, y, size: 8 });
  y -= 20;

  const barcodeY = 52;
  const barcodeX = margin;
  const barcodeHeight = 32;
  const bars = trackingToBars(content.trackingNumber);

  texts.push({
    text: content.trackingNumber,
    x: margin,
    y: barcodeY - 8,
    size: 10,
    bold: true,
  });

  texts.push({
    text: "KAUF26 mock label",
    x: margin,
    y: 18,
    size: 7,
  });

  const streamParts: string[] = ["q"];
  for (const t of texts) {
    const font = t.bold ? "/F2" : "/F1";
    const size = t.size ?? 10;
    streamParts.push(
      "BT",
      `${font} ${size} Tf`,
      `${t.x} ${t.y} Td`,
      `(${escapePdfText(t.text)}) Tj`,
      "ET"
    );
  }

  streamParts.push("0 0 0 rg");
  for (const bar of bars) {
    streamParts.push(
      `${barcodeX + bar.x} ${barcodeY} ${bar.w} ${barcodeHeight} re f`
    );
  }
  streamParts.push("Q");

  const stream = streamParts.join("\n");
  const streamLength = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>endobj`,
    `4 0 obj<< /Length ${streamLength} >>stream\n${stream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
    "6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function generateMockLabelPdf(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
  carrier?: string;
  service: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  shipDate?: string;
}): Promise<{ filename: string; filePath: string; url: string; trackingNumber: string }> {
  await ensureLabelsDir();

  const carrier = input.carrier?.trim() || inferCarrierFromService(input.service);
  const trackingNumber =
    input.trackingNumber?.trim() || generateMockTrackingNumber(carrier);

  const content: ShippingLabelContent = {
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    packageDetails: input.packageDetails,
    carrier,
    service: input.service,
    trackingNumber,
    estimatedDelivery: input.estimatedDelivery,
    shipDate: input.shipDate,
  };

  const filename = `label-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
  const filePath = path.join(LABELS_DIR, filename);

  await fs.writeFile(filePath, buildLabelPdf(content));

  return { filename, filePath, url: publicLabelUrl(filename), trackingNumber };
}

function inferCarrierFromService(service: string): string {
  const s = service.toLowerCase();
  if (s.includes("fedex")) return "FedEx";
  if (s.includes("ups")) return "UPS";
  if (s.includes("usps") || s.includes("priority") || s.includes("ground advantage")) {
    return "USPS";
  }
  return "Carrier";
}

/** HTML label for client-side print (mobile expo-print). */
export function generateLabelHtml(input: Omit<ShippingLabelContent, "trackingNumber"> & {
  trackingNumber?: string;
}): string {
  const carrier = input.carrier?.trim() || inferCarrierFromService(input.service);
  const trackingNumber =
    input.trackingNumber?.trim() || generateMockTrackingNumber(carrier);
  return buildShippingLabelHtml({ ...input, carrier, trackingNumber });
}
