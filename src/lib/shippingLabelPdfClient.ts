import { jsPDF } from "jspdf";
import {
  formatAddressLines,
  formatCarrierService,
  type ShippingLabelContent,
} from "../../shared/shippingLabelTemplate";

const PAGE_W = 4;
const PAGE_H = 6;
const MARGIN = 0.14;

function drawBarcode(doc: jsPDF, tracking: string, x: number, y: number, height: number): void {
  let cursor = x;
  for (const ch of tracking) {
    const w = ((ch.charCodeAt(0) % 3) + 1) * 0.012;
    doc.rect(cursor, y, w, height, "F");
    cursor += w + 0.008;
  }
}

/** Build a 4×6 in shipping label PDF in the browser (jsPDF). */
export function createShippingLabelPdfDoc(content: ShippingLabelContent): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [PAGE_W, PAGE_H],
  });

  let y = MARGIN;
  const carrierLine = formatCarrierService(content.carrier, content.service);
  const shipDate = content.shipDate?.trim() || new Date().toLocaleDateString();
  const estDelivery = content.estimatedDelivery?.trim() || "See carrier tracking";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(carrierLine, MARGIN, y + 0.12);
  y += 0.22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Ship date: ${shipDate} · Est. delivery: ${estDelivery}`, MARGIN, y + 0.08);
  y += 0.18;

  doc.setLineWidth(0.02);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 0.14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SHIP TO", MARGIN, y + 0.08);
  y += 0.12;

  const toLines = formatAddressLines(content.toAddress);
  toLines.forEach((line, index) => {
    doc.setFont("helvetica", index === 0 ? "bold" : "normal");
    doc.setFontSize(index === 0 ? 12 : 10);
    doc.text(line, MARGIN, y + 0.1);
    y += index === 0 ? 0.18 : 0.14;
  });

  y += 0.08;
  doc.setLineWidth(0.01);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 0.12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FROM / RETURN", MARGIN, y + 0.08);
  y += 0.11;

  formatAddressLines(content.fromAddress).forEach((line) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(line, MARGIN, y + 0.08);
    y += 0.11;
  });

  y += 0.06;
  const weight = content.packageDetails.weightLbs ?? 1;
  const dims = `${content.packageDetails.lengthIn ?? 10}×${content.packageDetails.widthIn ?? 10}×${content.packageDetails.heightIn ?? 10} in`;
  doc.setFontSize(7);
  doc.text(`Weight: ${weight} lb · Dims: ${dims}`, MARGIN, y + 0.08);

  const barcodeY = PAGE_H - 1.05;
  drawBarcode(doc, content.trackingNumber, MARGIN, barcodeY, 0.35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(content.trackingNumber, MARGIN, PAGE_H - 0.55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("KAUF26 · Mock label — not valid for carrier drop-off", MARGIN, PAGE_H - 0.28);

  return doc;
}

export function downloadShippingLabelPdf(content: ShippingLabelContent): void {
  const doc = createShippingLabelPdfDoc(content);
  doc.save(`shipping-label-${content.trackingNumber}.pdf`);
}

export function printShippingLabelPdfClient(content: ShippingLabelContent): void {
  const doc = createShippingLabelPdfDoc(content);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export function shippingLabelContentFromApiResponse(input: {
  fromAddress: ShippingLabelContent["fromAddress"];
  toAddress: ShippingLabelContent["toAddress"];
  packageDetails: ShippingLabelContent["packageDetails"];
  carrier?: string | null;
  service?: string | null;
  trackingNumber: string;
  estimatedDelivery?: string | null;
}): ShippingLabelContent {
  const carrier =
    input.carrier?.trim() ||
    (input.service?.toLowerCase().includes("fedex")
      ? "FedEx"
      : input.service?.toLowerCase().includes("ups")
        ? "UPS"
        : input.service?.toLowerCase().includes("usps")
          ? "USPS"
          : "Carrier");

  return {
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    packageDetails: input.packageDetails,
    carrier,
    service: input.service?.trim() || "Standard",
    trackingNumber: input.trackingNumber,
    estimatedDelivery: input.estimatedDelivery ?? undefined,
    shipDate: new Date().toLocaleDateString(),
  };
}
