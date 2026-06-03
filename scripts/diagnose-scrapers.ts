/**
 * Run: npx tsx scripts/diagnose-scrapers.ts
 * Tests scraper configs without printing API keys.
 */
import "dotenv/config";
import { ApifyClient } from "apify-client";
import { scrapeProduct } from "../server/scrapers/masterScraper.js";

async function main() {
  console.log("=== ENV ===");
  for (const k of [
    "APIFY_API_KEY",
    "APIFY_ACTOR_ID",
    "GOOGLE_API_KEY",
    "GOOGLE_CX",
    "RAPIDAPI_KEY",
    "EBAY_APP_ID",
  ]) {
    const v = process.env[k];
    console.log(`${k}: ${v ? `set (${v.length} chars)` : "MISSING"}`);
  }

  const query = "Breitling watch";
  const actorId = process.env.APIFY_ACTOR_ID?.trim() || "apify/e-commerce-scraping-tool";

  if (process.env.APIFY_API_KEY) {
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

    const wrongInput = {
      search: query,
      limit: 8,
      scrapeMode: "AUTO",
      country: "US",
    };

    const correctInput = {
      searchEngineKeyword: query,
      scrapeProductsFromSearchEngine: true,
      maxSearchEngineResults: 8,
      maxSearchEngineProducts: 8,
      scrapeMode: "AUTO",
      countryCode: "us",
      scrapeModeSearchEngine: "Products",
    };

    for (const [label, input] of [
      ["WRONG (current apify.ts)", wrongInput],
      ["CORRECT (actor schema)", correctInput],
    ] as const) {
      console.log(`\n=== Apify: ${label} ===`);
      console.log(JSON.stringify(input, null, 2));
      try {
        const run = await client.actor(actorId).call(input, { waitSecs: 90 });
        console.log("Run:", run.status, run.id);
        const { items } = await client
          .dataset(run.defaultDatasetId)
          .listItems({ limit: 3 });
        console.log("Items returned:", items?.length ?? 0);
        if (items?.length) {
          console.log("Sample:", JSON.stringify(items.slice(0, 3), null, 2));
        }
      } catch (e) {
        console.log("ERROR:", e instanceof Error ? e.message : e);
      }
    }
  }

  if (process.env.RAPIDAPI_KEY) {
    console.log("\n=== RapidAPI eBay scraper ===");
    try {
      const url = `https://ebay-data-scraper.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1`;
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "ebay-data-scraper.p.rapidapi.com",
        },
      });
      console.log("HTTP", res.status);
      const data = await res.json();
      const items = (data as { items?: unknown[] }).items ?? [];
      console.log("Items:", items.length);
      if (items.length > 0) {
        console.log("First item:", JSON.stringify(items[0], null, 2));
      }
    } catch (e) {
      console.log("ERROR:", e instanceof Error ? e.message : e);
    }
  }

  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX) {
    console.log("\n=== Google CSE ===");
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", process.env.GOOGLE_API_KEY);
    url.searchParams.set("cx", process.env.GOOGLE_CX);
    url.searchParams.set("q", `${query} price`);
    url.searchParams.set("num", "5");
    const res = await fetch(url);
    console.log("HTTP", res.status);
    const data = (await res.json()) as { items?: unknown[]; error?: unknown };
    if ((data as { error?: { message?: string } }).error) {
      console.log("API error:", JSON.stringify(data.error));
    } else {
      console.log("Items:", data.items?.length ?? 0);
      if (data.items?.[0]) console.log("First:", JSON.stringify(data.items[0], null, 2));
    }
  } else {
    console.log("\n=== Google CSE: SKIPPED (no GOOGLE_API_KEY / GOOGLE_CX) ===");
  }

  console.log("\n=== MasterScraper (Breitling) ===");
  const t0 = Date.now();
  const result = await scrapeProduct("Breitling Navitimer Chronograph", {
    vision: {
      visionTitle: "Breitling Navitimer Chronograph",
      visionBrand: "Breitling",
    },
  });
  console.log(`Elapsed: ${Date.now() - t0}ms`);
  console.log(result ? JSON.stringify(result, null, 2) : "null");
}

main().catch(console.error);
