#!/usr/bin/env npx tsx
/**
 * Example: register marketplace authenticators and run headless login.
 *
 *   npm install
 *   npx playwright install chromium
 *   EBAY_EMAIL=... EBAY_PASSWORD=... npx tsx scripts/browser-auth-example.ts
 */
import {
  AuthenticationService,
  EbayAuthenticator,
  StandardLoginAuthenticator,
} from "../server/services/browserAuth";

async function main() {
  const auth = new AuthenticationService();
  auth.register(new EbayAuthenticator());

  // Allegro-style placeholder: standard email/password flow + custom logged-in check
  auth.register(
    new StandardLoginAuthenticator(
      "allegro",
      {
        loginUrl: "https://allegro.pl/login",
        postLoginUrlPattern: /allegro\.pl/i,
      },
      {},
      async (page) => !page.url().includes("/login")
    )
  );

  const email = process.env.EBAY_EMAIL ?? process.env.MARKETPLACE_EMAIL;
  const password = process.env.EBAY_PASSWORD ?? process.env.MARKETPLACE_PASSWORD;
  if (!email || !password) {
    console.error("Set EBAY_EMAIL and EBAY_PASSWORD (or MARKETPLACE_*).");
    process.exit(1);
  }

  const result = await auth.authenticate(
    "ebay",
    { email, password },
    {
      headless: true,
      locale: "en",
      // otp: { type: "manual", waitForCode: () => promptForCode() },
    }
  );

  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
