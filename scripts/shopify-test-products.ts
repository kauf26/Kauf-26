#!/usr/bin/env npx tsx
/**
 * Test Shopify Admin API — fetch products and print the first title.
 *
 *   npm run test:shopify
 *   npm run test:shopify -- --open     # open OAuth URL on scope approval 403
 *   npx tsx scripts/shopify-test-products.ts
 *
 * Required .env:
 *   SHOPIFY_STORE_NAME   (or SHOPIFY_SHOP_DOMAIN)
 *   SHOPIFY_CLIENT_ID
 *   SHOPIFY_CLIENT_SECRET
 *   SHOPIFY_ACCESS_TOKEN
 *
 * For scope approval 403, also set:
 *   SHOPIFY_OAUTH_REDIRECT_URI  (must match Shopify app allowed redirect URL)
 *   SHOPIFY_OAUTH_SCOPES        (optional; default read_products,write_products)
 */
import { execSync } from "node:child_process";
import "dotenv/config";
import {
  fetchFirstShopifyProductTitle,
  fetchShopifyProducts,
  loadShopifyConfigFromEnv,
  refreshShopifyAccessToken,
  resolveShopifyStoreDomain,
  ShopifyApiError,
  ShopifyScopeApprovalRequiredError,
} from "../server/services/shopifyApi";

function mask(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function shouldOpenBrowser(): boolean {
  return process.argv.includes("--open");
}

function tryOpenUrl(url: string): void {
  try {
    execSync(`open ${JSON.stringify(url)}`, { stdio: "ignore" });
    console.log("\nOpened OAuth URL in your default browser.");
  } catch {
    console.log("\nCould not open a browser automatically — copy the URL above.");
  }
}

function handleScopeApprovalError(err: ShopifyScopeApprovalRequiredError): never {
  console.error("\n⚠️  Shopify scope approval required\n");
  console.error(err.reauthorizeMessage);

  if (err.authorizeUrl) {
    console.error("\n--- OAuth authorize URL ---");
    console.error(err.authorizeUrl);
    if (shouldOpenBrowser()) {
      tryOpenUrl(err.authorizeUrl);
    } else {
      console.error("\nTip: re-run with --open to launch this URL in your browser.");
    }
  }

  process.exit(2);
}

async function main(): Promise<void> {
  console.log("Shopify Admin API — product fetch test\n");

  let config;
  try {
    const storeDomain = resolveShopifyStoreDomain();
    console.log("Store:", storeDomain);
    config = loadShopifyConfigFromEnv();
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      console.error(err.message);
      console.error("\nSet these in .env:");
      console.error("  SHOPIFY_STORE_NAME=your-store");
      console.error("  SHOPIFY_CLIENT_ID=...");
      console.error("  SHOPIFY_CLIENT_SECRET=...");
      console.error("  SHOPIFY_ACCESS_TOKEN=...");
      process.exit(1);
    }
    throw err;
  }

  let activeConfig = config;
  console.log("Client ID:", mask(activeConfig.clientId));
  console.log("Access token:", mask(activeConfig.accessToken));
  console.log("");

  try {
    const products = await fetchShopifyProducts(activeConfig, 3);
    if (products.length === 0) {
      console.log("Connected successfully, but the store has no products.");
      process.exit(0);
    }

    console.log(`Fetched ${products.length} product(s):`);
    for (const p of products) {
      console.log(`  - [${p.id}] ${p.title}${p.status ? ` (${p.status})` : ""}`);
    }
    console.log("\nFirst product title:", products[0]!.title);
    process.exit(0);
  } catch (err) {
    if (err instanceof ShopifyScopeApprovalRequiredError) {
      handleScopeApprovalError(err);
    }

    if (
      err instanceof ShopifyApiError &&
      err.status === 401 &&
      activeConfig.clientId &&
      activeConfig.clientSecret
    ) {
      console.warn("Access token rejected — refreshing via client_credentials…");
      try {
        const refreshed = await refreshShopifyAccessToken(activeConfig);
        activeConfig = { ...activeConfig, accessToken: refreshed.accessToken };
        process.env.SHOPIFY_ACCESS_TOKEN = refreshed.accessToken;
        console.log(
          "New token obtained",
          refreshed.expiresIn ? `(expires in ${refreshed.expiresIn}s)` : ""
        );

        const title = await fetchFirstShopifyProductTitle(activeConfig);
        if (title) {
          console.log("\nFirst product title:", title);
          console.log(
            "\nUpdate SHOPIFY_ACCESS_TOKEN in .env with the new token if needed."
          );
          process.exit(0);
        }
        console.log("\nConnected after refresh, but the store has no products.");
        process.exit(0);
      } catch (refreshErr) {
        if (refreshErr instanceof ShopifyScopeApprovalRequiredError) {
          handleScopeApprovalError(refreshErr);
        }
        throw refreshErr;
      }
    }

    if (err instanceof ShopifyApiError) {
      console.error(`\nShopify API error (${err.status}): ${err.message}`);
      if (err.status === 0) {
        console.error("\nSet these in .env:");
        console.error("  SHOPIFY_STORE_NAME=your-store");
        console.error("  SHOPIFY_CLIENT_ID=...");
        console.error("  SHOPIFY_CLIENT_SECRET=...");
        console.error("  SHOPIFY_ACCESS_TOKEN=...");
      }
      process.exit(1);
    }

    console.error("\nUnexpected error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  if (err instanceof ShopifyScopeApprovalRequiredError) {
    handleScopeApprovalError(err);
  }
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
