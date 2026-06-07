#!/usr/bin/env npx tsx
/**
 * Example: IAuthStrategy + AuthenticationService
 *
 *   npx playwright install chromium
 *   EBAY_EMAIL=... EBAY_PASSWORD=... npx tsx scripts/browser-auth-example.ts
 */
import {
  AuthenticationService,
  EbayAuthStrategy,
  StandardLoginAuthStrategy,
} from "../server/services/browserAuth";

async function main() {
  const email = process.env.EBAY_EMAIL ?? process.env.MARKETPLACE_EMAIL;
  const password = process.env.EBAY_PASSWORD ?? process.env.MARKETPLACE_PASSWORD;
  if (!email || !password) {
    console.error("Set EBAY_EMAIL and EBAY_PASSWORD.");
    process.exit(1);
  }

  const auth = new AuthenticationService();

  auth.registerStrategy(
    "ebay",
    new EbayAuthStrategy({ email, password }, { locale: "en" })
  );

  auth.registerStrategy(
    "allegro",
    new StandardLoginAuthStrategy(
      "allegro",
      { email, password },
      { loginUrl: "https://allegro.pl/login" },
      {},
      async (page) => !page.url().includes("/login")
    )
  );

  // Full flow: browser launch + cookie persistence
  const result = await auth.authenticateWithSession("ebay", { headless: true });
  console.log(result);

  // Page-level API (your proposed shape) when you already own a Page:
  // await auth.authenticate("ebay", existingPage);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
