import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { UPLOADS_DIR } from "./draftPhotoUpload";

export const LABELS_DIR = path.join(UPLOADS_DIR, "labels");

export type AddressJson = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type PackageDetailsJson = {
  weightLbs?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
};

export async function ensureLabelsDir(): Promise<void> {
  await fs.mkdir(LABELS_DIR, { recursive: true });
}

export function publicLabelUrl(filename: string): string {
  return `/uploads/labels/${filename}`;
}

export { mockShippingRates } from "./shippingRatesService";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatAddress(addr: AddressJson): string[] {
  const lines: string[] = [];
  if (addr.name) lines.push(addr.name);
  if (addr.line1) lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const cityLine = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines.length ? lines : ["Address not provided"];
}

/** Minimal PDF 1.4 writer (no external deps). */
function buildSimplePdf(lines: string[]): Buffer {
  const contentLines = ["BT", "/F1 11 Tf", "50 750 Td"];
  lines.forEach((line, index) => {
    if (index > 0) contentLines.push("0 -16 Td");
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const streamLength = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 288 432] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${streamLength} >>stream\n${stream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
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
  service: string;
  trackingNumber: string;
}): Promise<{ filename: string; filePath: string; url: string }> {
  await ensureLabelsDir();

  const filename = `label-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
  const filePath = path.join(LABELS_DIR, filename);

  const lines = [
    "KAUF26 SHIPPING LABEL",
    `Service: ${input.service}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `Weight: ${input.packageDetails.weightLbs ?? 1} lb`,
    `Dims: ${input.packageDetails.lengthIn ?? 10}x${input.packageDetails.widthIn ?? 10}x${input.packageDetails.heightIn ?? 10} in`,
    "SHIP TO:",
    ...formatAddress(input.toAddress),
    "FROM:",
    ...formatAddress(input.fromAddress),
    `Tracking: ${input.trackingNumber}`,
    "||||| |||| ||||| |||| |||||",
  ];

  await fs.writeFile(filePath, buildSimplePdf(lines));

  return { filename, filePath, url: publicLabelUrl(filename) };
}
