import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { generateMockLabelPdf } from "../server/services/shippingLabelPdf";

describe("shippingLabelPdf", () => {
  it("embeds ship-to and ship-from addresses in PDF bytes", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kauf26-label-"));
    const prev = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmp;

    try {
      const result = await generateMockLabelPdf({
        fromAddress: {
          name: "Seller Co",
          line1: "100 Main St",
          city: "Portland",
          state: "OR",
          postalCode: "97201",
          country: "US",
        },
        toAddress: {
          name: "Buyer Name",
          line1: "200 Elm St",
          city: "Seattle",
          state: "WA",
          postalCode: "98101",
          country: "US",
        },
        packageDetails: { weightLbs: 1.5, lengthIn: 12, widthIn: 9, heightIn: 4 },
        carrier: "FedEx",
        service: "2Day",
        estimatedDelivery: "Jun 15, 2026",
      });

      const pdfPath = path.join(tmp, "labels", result.filename);
      const bytes = await fs.readFile(pdfPath);
      const text = bytes.toString("utf8");

      expect(text).toContain("Buyer Name");
      expect(text).toContain("200 Elm St");
      expect(text).toContain("Seller Co");
      expect(text).toContain("100 Main St");
      expect(text).toContain("FedEx 2Day");
      expect(text).toContain(result.trackingNumber);
      expect(text).toContain("Est. delivery");
    } finally {
      if (prev === undefined) delete process.env.UPLOADS_DIR;
      else process.env.UPLOADS_DIR = prev;
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
