#!/usr/bin/env npx tsx
/**
 * Dry-run all marketplace adapters with a mock draft (no live API calls).
 *
 *   npm run test:adapters
 *   npx tsx scripts/test-adapters.ts --marketplaces amazon,etsy,ebay
 */
import "dotenv/config";
import {
  getAllAdapterIds,
  getAdapter,
  publishOne,
} from "../server/services/adapters";
import {
  MASTER_MARKETPLACES,
  getEnabledMarketplaceIds,
} from "../server/config/marketplaces";
import type { DraftPublishPayload } from "../server/publishToMarketplaces";

const mockDraft: DraftPublishPayload = {
  draftId: 9999,
  title: "Rolex Submariner Date 41mm Steel Black Dial",
  sku: "TEST-SUB-001",
  images: ["data:image/jpeg;base64,/9j/mock"],
  attributes: {
    brand: "Rolex",
    category: "Watches",
    condition: "Used",
    material: "stainless steel",
    color: "black",
    medianPrice: "9500",
    marketPrices: { recommendedPrice: "9500", allegroAvg: "9200", ebayAvg: "9800" },
    aiDescription:
      "Pre-owned Rolex Submariner with black dial and oyster bracelet.",
    longDescription:
      "Authentic Rolex Submariner Date. Includes box and papers. Serviced 2024.",
  },
};

function parseMarketplacesArg(): string[] | undefined {
  const idx = process.argv.indexOf("--marketplaces");
  if (idx === -1 || !process.argv[idx + 1]) return undefined;
  return process.argv[idx + 1]
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const requested = parseMarketplacesArg();
  const ids =
    requested && requested.length > 0
      ? requested
      : getAllAdapterIds().length > 0
        ? getAllAdapterIds()
        : getEnabledMarketplaceIds();

  console.log(`Testing ${ids.length} marketplace adapter(s) (dry-run)…\n`);

  let ok = 0;
  let fail = 0;

  for (const id of ids) {
    const cfg = MASTER_MARKETPLACES.find((m) => m.id === id);
    const adapter = getAdapter(id);

    if (!adapter) {
      console.log(`✗ ${id}: no adapter registered`);
      fail++;
      continue;
    }

    const formatted = adapter.format(mockDraft);
    const result = await publishOne(id, mockDraft);

    const icon = result.success ? (result.dryRun ? "○" : "✓") : "✗";
    const method = cfg?.apiMethod ?? "?";
    const status = cfg?.implementationStatus ?? "unknown";

    console.log(`${icon} ${id} [${method}/${status}]`);
    console.log(`   message: ${result.message}`);
    console.log(`   configured: ${adapter.isConfigured()}`);
    console.log(
      `   payload keys: ${Object.keys(formatted).join(", ")}`
    );
    if (formatted.apiBody) {
      console.log(
        `   apiBody sample: ${JSON.stringify(formatted.apiBody).slice(0, 120)}…`
      );
    }
    console.log("");

    if (result.success) ok++;
    else fail++;
  }

  console.log("—".repeat(48));
  console.log(`Passed: ${ok} | Failed: ${fail} | Total: ${ids.length}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
