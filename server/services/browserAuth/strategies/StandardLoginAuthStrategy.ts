import type { Page } from "playwright";
import { BaseAuthStrategy, type LoginFlowConfig } from "../BaseAuthStrategy";
import { LocaleKey } from "../localeKeys";
import { LocalizationWrapper } from "../localization";
import type {
  AuthCredentials,
  BrowserAuthOptions,
  MarketplaceId,
} from "../types";

export type StandardLoginSelectors = {
  emailSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
};

/**
 * Generic email/username + password flow for marketplaces without OAuth APIs.
 */
export class StandardLoginAuthStrategy extends BaseAuthStrategy {
  constructor(
    readonly marketplaceId: MarketplaceId,
    credentials: AuthCredentials,
    config: LoginFlowConfig,
    private readonly selectors: StandardLoginSelectors = {},
    private readonly loggedInCheck: (page: Page) => Promise<boolean>,
    options: BrowserAuthOptions = {}
  ) {
    super(credentials, config, options);
  }

  protected async runLoginFlow(
    page: Page,
    i18n: LocalizationWrapper
  ): Promise<void> {
    const email = this.credentials.email ?? this.credentials.username;
    if (!email) {
      throw new Error(`${this.marketplaceId}: email or username required`);
    }

    await i18n.clickByKey(LocaleKey.SIGN_IN, { role: "link" }).catch(() => {});

    if (this.selectors.emailSelector) {
      await page.locator(this.selectors.emailSelector).fill(email);
    } else {
      await i18n.fillLabeledField(LocaleKey.EMAIL, email).catch(async () => {
        await i18n.fillLabeledField(LocaleKey.USERNAME, email);
      });
    }

    if (this.selectors.passwordSelector) {
      await page.locator(this.selectors.passwordSelector).fill(this.credentials.password);
    } else {
      await i18n.fillLabeledField(LocaleKey.PASSWORD, this.credentials.password);
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

/** @deprecated Use StandardLoginAuthStrategy */
export const StandardLoginAuthenticator = StandardLoginAuthStrategy;
