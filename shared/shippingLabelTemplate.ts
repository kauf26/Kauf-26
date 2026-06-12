/** Shared shipping label content for PDF (server) and HTML print (mobile/web). */

export type LabelAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type LabelPackageDetails = {
  weightLbs?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
};

export type ShippingLabelContent = {
  fromAddress: LabelAddress;
  toAddress: LabelAddress;
  packageDetails: LabelPackageDetails;
  carrier: string;
  service: string;
  trackingNumber: string;
  estimatedDelivery?: string;
  shipDate?: string;
};

export function formatAddressLines(addr: LabelAddress): string[] {
  const lines: string[] = [];
  if (addr.name?.trim()) lines.push(addr.name.trim());
  if (addr.line1?.trim()) lines.push(addr.line1.trim());
  if (addr.line2?.trim()) lines.push(addr.line2.trim());
  const cityLine = [addr.city, addr.state, addr.postalCode]
    .filter((p) => p?.trim())
    .join(", ");
  if (cityLine.trim()) lines.push(cityLine.trim());
  if (addr.country?.trim() && addr.country.trim().toUpperCase() !== "US") {
    lines.push(addr.country.trim());
  }
  return lines.length ? lines : ["Address not provided"];
}

export function formatAddressBlock(addr: LabelAddress): string {
  return formatAddressLines(addr).join("\n");
}

export function formatCarrierService(carrier: string, service: string): string {
  const c = carrier.trim();
  const s = service.trim();
  if (c && s) return `${c} ${s}`;
  return s || c || "Standard Shipping";
}

export function generateMockTrackingNumber(carrier: string): string {
  const key = carrier.toLowerCase();
  const suffix = String(Date.now()).slice(-10);
  if (key.includes("usps")) return `9400${suffix}${Math.floor(Math.random() * 10)}`;
  if (key.includes("fedex")) return `${suffix}${Math.floor(Math.random() * 1000)}`;
  if (key.includes("ups")) return `1Z999AA1${suffix.slice(0, 10)}`;
  return `1Z999AA1${suffix.slice(0, 10)}`;
}

/** 4×6 in label HTML for expo-print / browser print. */
export function buildShippingLabelHtml(content: ShippingLabelContent): string {
  const shipTo = formatAddressLines(content.toAddress);
  const shipFrom = formatAddressLines(content.fromAddress);
  const carrierLine = formatCarrierService(content.carrier, content.service);
  const weight = content.packageDetails.weightLbs ?? 1;
  const dims = `${content.packageDetails.lengthIn ?? 10}×${content.packageDetails.widthIn ?? 10}×${content.packageDetails.heightIn ?? 10} in`;
  const estDelivery = content.estimatedDelivery?.trim() || "See carrier tracking";
  const shipDate = content.shipDate?.trim() || new Date().toLocaleDateString();

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const shipToHtml = shipTo.map((l) => `<div class="ship-line">${escape(l)}</div>`).join("");
  const shipFromHtml = shipFrom.map((l) => `<div class="from-line">${escape(l)}</div>`).join("");

  const bars = content.trackingNumber
    .split("")
    .map((ch, i) => {
      const w = (ch.charCodeAt(0) % 3) + 1;
      return `<span style="display:inline-block;width:${w}px;height:36px;background:#000;margin-right:1px"></span>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: 4in 6in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 4in; height: 6in; font-family: Helvetica, Arial, sans-serif;
    color: #000; background: #fff; padding: 10px 12px; font-size: 10pt;
  }
  .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .carrier { font-size: 13pt; font-weight: 700; }
  .meta { font-size: 8pt; color: #333; margin-top: 3px; }
  .section-title { font-size: 8pt; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
  .ship-to { margin-bottom: 12px; min-height: 1.8in; }
  .ship-line { font-size: 12pt; line-height: 1.25; font-weight: 600; }
  .ship-line:first-child { font-size: 14pt; }
  .from { border-top: 1px solid #999; padding-top: 6px; margin-bottom: 10px; }
  .from-line { font-size: 8pt; line-height: 1.3; }
  .pkg { font-size: 8pt; color: #444; margin-bottom: 10px; }
  .barcode { text-align: center; margin: 8px 0 4px; letter-spacing: 0; line-height: 0; }
  .tracking { text-align: center; font-size: 11pt; font-weight: 700; font-family: monospace; }
  .footer { font-size: 7pt; text-align: center; color: #666; margin-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    <div class="carrier">${escape(carrierLine)}</div>
    <div class="meta">Ship date: ${escape(shipDate)} · Est. delivery: ${escape(estDelivery)}</div>
  </div>
  <div class="ship-to">
    <div class="section-title">SHIP TO</div>
    ${shipToHtml}
  </div>
  <div class="from">
    <div class="section-title">FROM / RETURN</div>
    ${shipFromHtml}
  </div>
  <div class="pkg">Weight: ${weight} lb · Dims: ${escape(dims)}</div>
  <div class="barcode">${bars}</div>
  <div class="tracking">${escape(content.trackingNumber)}</div>
  <div class="footer">KAUF26 · Mock label — not valid for carrier drop-off</div>
</body>
</html>`;
}
