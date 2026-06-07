import type { Page } from "playwright";
import { DefaultOtpHandler } from "./otpHandler";
import { LocalizationWrapper } from "./localization";
import type { SupportedLocale } from "./localeKeys";
import type {
  AuthCredentials,
  BrowserAuthOptions,
  IAuthStrategy,
  MarketplaceId,
  OtpHandler,
} from "./types";

export type LoginFlowConfig = {
  loginUrl: string;
  postLoginUrlPattern?: RegExp;
  verifyUrl?: string;
};

/**
 * Shared login helpers — subclasses implement `runLoginFlow` + `isLoggedIn`.
 */
export abstract class BaseAuthStrategy implements IAuthStrategy {
  abstract readonly marketplaceId: MarketplaceId;

  protected readonly otpHandler: OtpHandler;

  constructor(
    protected readonly credentials: AuthCredentials,
    protected readonly config: LoginFlowConfig,
    protected readonly options: BrowserAuthOptions = {},
    otpHandler?: OtpHandler
  ) {
    this.otpHandler = otpHandler ?? new DefaultOtpHandler();
  }

  protected abstract runLoginFlow(
    page: Page,
    i18n: LocalizationWrapper
  ): Promise<void>;

  abstract isLoggedIn(page: Page): Promise<boolean>;

  async login(page: Page): Promise<void> {
    const i18n = new LocalizationWrapper(
      page,
      (this.options.locale ?? "en") as SupportedLocale
    );

    await page.goto(this.config.loginUrl, { waitUntil: "domcontentloaded" });
    await this.runLoginFlow(page, i18n);

    if (this.options.otp) {
      await this.otpHandler.resolve(
        { marketplaceId: this.marketplaceId, page },
        this.options.otp
      );
    }

    if (this.config.postLoginUrlPattern) {
      await page.waitForURL(this.config.postLoginUrlPattern, { timeout: 60_000 });
    }

    if (!(await this.isLoggedIn(page))) {
      throw new Error(
        `Login failed for ${this.marketplaceId} — session not verified`
      );
    }
  }

  /** URL to open when checking a restored session. */
  verifyUrl(): string {
    return this.config.verifyUrl ?? this.config.loginUrl;
  }
}
