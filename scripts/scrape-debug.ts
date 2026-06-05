#!/usr/bin/env npx tsx
/**
 * Debug scraper pipeline without camera/vision.
 *
 * Usage:
 *   IDENTIFY_DEBUG=true npm run scrape:debug -- "Rolex Submariner"
 *   npm run scrape:debug -- "Rolex Submariner" --brand Rolex --material "stainless steel" --color "black and silver"
 */
import "dotenv/config";
import { scrapeProduct } from "../server/scrapers/masterScraper";
import { canScraperOverrideVision } from "../server/scrapers/exactMatchGate";
import { detectLuxuryProfile } from "../server/scrapers/luxuryPricing";

process.env.IDENTIFY_DEBUG = "true";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

const positional = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"));

const query = positional.join(" ").trim();
const brand = argValue("--brand");
const material = argValue("--material");
const color = argValue("--color");

async function main() {
  if (!query) {
    console.error(
      "Usage: npm run scrape:debug -- \"Rolex Submariner\" [--brand Rolex] [--material \"stainless steel\"] [--color \"black and silver\"]"
    );
    process.exit(1);
  }

  console.log("[scrape:debug] query:", query);
  console.log("[scrape:debug] luxury profile:", detectLuxuryProfile(brand, query));

  const result = (await scrapeProduct(query, {
    vision: {
      visionTitle: query,
      visionBrand: brand ?? "",
    },
  })) as Record<string, unknown> | null;

  console.log("\n[scrape:debug] masterScraper result:");
  console.log(
    JSON.stringify(
      {
        title: result?.title,
        brand: result?.brand,
        model: result?.model,
        price: result?.price,
        medianPrice: result?.medianPrice,
        priceReliable: result?.priceReliable,
        isExactMatch: result?.isExactMatch,
        matchType: result?.matchType,
        scraperSource: result?.scraperSource,
        material: result?.material,
        color: result?.color,
      },
      null,
      2
    )
  );

  if (result) {
    const gate = canScraperOverrideVision({
      visionTitle: query,
      visionBrand: brand,
      visionMaterial: material,
      visionColor: color,
      scraperTitle: String(result.title ?? ""),
      scraperBrand: String(result.brand ?? ""),
      price: result.medianPrice ?? result.price,
      description: String(result.description ?? ""),
      url: String(result.url ?? result.link ?? result.productUrl ?? ""),
      isExactMatch: result.isExactMatch === true,
    });
    console.log("\n[scrape:debug] override gate:");
    console.log(JSON.stringify(gate, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
