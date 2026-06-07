import type { Page } from "playwright";
import { BaseAuthenticator, type LoginFlowConfig } from "../BaseAuthenticator";
import { LocaleKey } from "../localeKeys";
import { LocalizationWrapper } from "../localization";
import type { AuthCredentials, MarketplaceId } from "../types";

export type StandardLoginSelectors = {
  /** CSS selector if locale-based lookup is insufficient. */
  emailSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
};

/**
 * Generic email/username + password flow for marketplaces without OAuth APIs.
 * Subclass per platform or pass config to specialize URLs and verification.
 */
export class StandardLoginAuthenticator extends BaseAuthenticator {
  constructor(
    readonly marketplaceId: MarketplaceId,
    private readonly config: LoginFlowConfig,
    private readonly selectors: StandardLoginSelectors = {},
    private readonly loggedInCheck: (page: Page) => Promise<boolean>
  ) {
    super();
  }

  protected getLoginConfig(): LoginFlowConfig {
    return this.config;
  }

  protected async runLoginFlow(
    page: Page,
    i18n: LocalizationWrapper,
    credentials: AuthCredentials
  ): Promise<void> {
    const email = credentials.email ?? credentials.username;
    if (!email) {
      throw new Error(`${this.marketplaceId}: email or username required`);
    }

    await i18n.clickByKey(LocaleKey.SIGN_IN, { role: "link" }).catch(() => {
      /* already on sign-in page */
    });

    if (this.selectors.emailSelector) {
      await page.locator(this.selectors.emailSelector).fill(email);
    } else {
      await i18n.fillLabeledField(LocaleKey.EMAIL, email).catch(async () => {
        await i18n.fillLabeledField(LocaleKey.USERNAME, email);
      });
    }

    if (this.selectors.passwordSelector) {
      await page.locator(this.selectors.passwordSelector).fill(credentials.password);
    } else {
      await i18n.fillLabeledField(LocaleKey.PASSWORD, credentials.password);
    }

    if (this.selectors.submitSelector) {
      await page.locator(this.selectors.submitSelector).click();
    } else {
      await i18n.clickByKey(LocaleKey.SUBMIT, { role: "button" });
    }
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    return this.loggedInCheck(page);
  }
}
