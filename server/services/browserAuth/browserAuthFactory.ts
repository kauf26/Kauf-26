import type { Page } from "playwright";
import { getBrowserAuthMarketplace } from "../../config/browserAuthMarketplaces";
import { AuthenticationService } from "./AuthenticationService";
import { EbayAuthStrategy } from "./strategies/EbayAuthStrategy";
import { StandardLoginAuthStrategy } from "./strategies/StandardLoginAuthStrategy";
import { UserSessionStore } from "./userSessionStore";
import type { AuthCredentials } from "./types";

export function createAuthenticationService(userId: number): AuthenticationService {
  return new AuthenticationService(new UserSessionStore(), userId);
}

function defaultLoggedInCheck(verifyUrl: string) {
  const host = new URL(verifyUrl).hostname.replace(/\./g, "\\.");
  const pattern = new RegExp(host, "i");
  return async (page: Page) => pattern.test(page.url());
}

/** Session restore only — no credential-based login. */
export function registerVerifyOnlyStrategy(
  auth: AuthenticationService,
  marketplaceId: string
): void {
  const config = getBrowserAuthMarketplace(marketplaceId);
  if (!config) return;

  const isLoggedIn = defaultLoggedInCheck(config.verifyUrl);
  auth.registerStrategy(marketplaceId, {
    marketplaceId,
    async login() {
      throw new Error(`${marketplaceId}: login requires credentials during onboarding`);
    },
    isLoggedIn,
  });
}

export function registerMarketplaceStrategy(
  auth: AuthenticationService,
  marketplaceId: string,
  credentials: AuthCredentials
): void {
  const config = getBrowserAuthMarketplace(marketplaceId);
  if (!config) {
    throw new Error(`No browser auth config for marketplace: ${marketplaceId}`);
  }

  if (config.strategy === "ebay") {
    auth.registerStrategy(marketplaceId, new EbayAuthStrategy(credentials));
    return;
  }

  auth.registerStrategy(
    marketplaceId,
    new StandardLoginAuthStrategy(
      marketplaceId,
      credentials,
      {
        loginUrl: config.loginUrl,
        verifyUrl: config.verifyUrl,
      },
      {},
      defaultLoggedInCheck(config.verifyUrl)
    )
  );
}
