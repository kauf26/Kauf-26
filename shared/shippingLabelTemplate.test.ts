import { describe, expect, it } from "vitest";
import {
  buildShippingLabelHtml,
  formatAddressLines,
  formatCarrierService,
  generateMockTrackingNumber,
} from "./shippingLabelTemplate";

describe("shippingLabelTemplate", () => {
  const from = {
    name: "KAUF26 Seller",
    line1: "123 Warehouse Rd",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90001",
    country: "US",
  };
  const to = {
    name: "Jane Buyer",
    line1: "456 Oak Ave",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
  };

  it("formats full address lines", () => {
    expect(formatAddressLines(to)).toEqual([
      "Jane Buyer",
      "456 Oak Ave",
      "Austin, TX, 78701",
    ]);
  });

  it("includes addresses and carrier in HTML label", () => {
    const html = buildShippingLabelHtml({
      fromAddress: from,
      toAddress: to,
      packageDetails: { weightLbs: 2, lengthIn: 10, widthIn: 8, heightIn: 6 },
      carrier: "FedEx",
      service: "2Day",
      trackingNumber: "7946TEST1234",
      estimatedDelivery: "Jun 14, 2026",
    });
    expect(html).toContain("Jane Buyer");
    expect(html).toContain("456 Oak Ave");
    expect(html).toContain("123 Warehouse Rd");
    expect(html).toContain("FedEx 2Day");
    expect(html).toContain("7946TEST1234");
    expect(html).toContain("Est. delivery");
  });

  it("builds carrier service line", () => {
    expect(formatCarrierService("FedEx", "2Day")).toBe("FedEx 2Day");
  });

  it("generates carrier-specific tracking stubs", () => {
    expect(generateMockTrackingNumber("USPS")).toMatch(/^9400/);
    expect(generateMockTrackingNumber("UPS")).toMatch(/^1Z/);
  });
});
