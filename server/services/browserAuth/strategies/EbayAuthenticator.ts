import type { Page } from "playwright";
import { BaseAuthenticator, type LoginFlowConfig } from "../BaseAuthenticator";
import { LocaleKey } from "../localeKeys";
import { LocalizationWrapper } from "../localization";
import type { AuthCredentials } from "../types";

const EBAY_SIGNIN =
  process.env.EBAY_SIGNIN_URL ?? "https://signin.ebay.com/ws/eBayISAPI.dll?SignIn";

const EBAY_SELLER_HUB =
  process.env.EBAY_SELLER_VERIFY_URL ?? "https://www.ebay.com/sh/ovw";

/**
 * eBay seller sign-in via headless browser (fallback when OAuth refresh fails).
 * Prefer REST OAuth (`EBAY_REFRESH_TOKEN`) for production publishing.
 */
export class EbayAuthenticator extends BaseAuthenticator {
  readonly marketplaceId = "ebay" as const;

  protected getLoginConfig(): LoginFlowConfig {
    return {
      loginUrl: EBAY_SIGNIN,
      postLoginUrlPattern: /ebay\.(com|co\.uk|de|pl|nl)/i,
      verifyUrl: EBAY_SELLER_HUB,
    };
  }

  protected async runLoginFlow(
    page: Page,
    i18n: LocalizationWrapper,
    credentials: AuthCredentials
  ): Promise<void> {
    const email = credentials.email ?? credentials.username;
    if (!email) throw new Error("eBay login requires email or username");

    await i18n.fillLabeledField(LocaleKey.EMAIL, email).catch(async () => {
      await page.locator("#userid").fill(email);
    });

    await i18n.clickByKey(LocaleKey.CONTINUE, { role: "button" }).catch(() => {
      /* single-step form on some locales */
    });

    await i18n.fillLabeledField(LocaleKey.PASSWORD, credentials.password).catch(
      async () => {
        await page.locator("#pass").fill(credentials.password);
      }
    );

    await i18n.clickByKey(LocaleKey.SIGN_IN, { role: "button" }).catch(async () => {
      await page.locator("#sgnBt").click();
    });
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    if (/signin\.ebay/i.test(url)) return false;

    const accountMenu = page.locator(
      '[data-testid="gh-uid"], #gh-ug, a[href*="/mye/myebay"]'
    );
    if (await accountMenu.first().isVisible().catch(() => false)) return true;

    return /\/sh\//i.test(url) || /myebay/i.test(url);
  }
}
