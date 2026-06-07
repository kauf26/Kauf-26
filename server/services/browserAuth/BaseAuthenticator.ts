import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { DefaultOtpHandler } from "./otpHandler";
import { LocalizationWrapper } from "./localization";
import { SessionStore } from "./sessionStore";
import type {
  AuthCredentials,
  AuthResult,
  BrowserAuthOptions,
  MarketplaceAuthenticator,
  MarketplaceId,
  OtpHandler,
} from "./types";
import type { SupportedLocale } from "./localeKeys";

export type LoginFlowConfig = {
  loginUrl: string;
  postLoginUrlPattern?: RegExp;
  verifyUrl?: string;
};

/**
 * Shared Playwright lifecycle, session persistence, localization, and OTP hooks.
 * Subclasses implement marketplace-specific steps via `runLoginFlow`.
 */
export abstract class BaseAuthenticator implements MarketplaceAuthenticator {
  abstract readonly marketplaceId: MarketplaceId;

  protected readonly sessionStore: SessionStore;
  protected readonly otpHandler: OtpHandler;

  constructor(sessionStore?: SessionStore, otpHandler?: OtpHandler) {
    this.sessionStore = sessionStore ?? new SessionStore();
    this.otpHandler = otpHandler ?? new DefaultOtpHandler();
  }

  protected abstract getLoginConfig(): LoginFlowConfig;

  protected abstract runLoginFlow(
    page: Page,
    i18n: LocalizationWrapper,
    credentials: AuthCredentials
  ): Promise<void>;

  abstract isLoggedIn(page: Page): Promise<boolean>;

  protected async handleOtpIfPresent(
    page: Page,
    options: BrowserAuthOptions
  ): Promise<void> {
    if (!options.otp) return;
    await this.otpHandler.resolve(
      { marketplaceId: this.marketplaceId, page },
      options.otp
    );
  }

  async restoreSession(
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult | null> {
    const store = this.resolveSessionStore(options);
    const storageState = await store.storageStateFor(this.marketplaceId);
    if (!storageState) return null;

    const browser = await this.launchBrowser(options);
    try {
      const context = await this.newContext(browser, options, storageState);
      const page = await context.newPage();
      const config = this.getLoginConfig();

      await page.goto(config.verifyUrl ?? config.loginUrl, {
        waitUntil: "domcontentloaded",
      });

      const loggedIn = await this.isLoggedIn(page);
      await context.close();
      await browser.close();

      if (!loggedIn) return null;

      return {
        marketplaceId: this.marketplaceId,
        success: true,
        sessionPath: storageState,
        message: "Restored persisted session",
        reusedSession: true,
      };
    } catch {
      await browser.close();
      return null;
    }
  }

  async login(
    credentials: AuthCredentials,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult> {
    const restored = await this.restoreSession(options);
    if (restored?.success) return restored;

    const browser = await this.launchBrowser(options);
    const context = await this.newContext(browser, options);
    const page = await context.newPage();
    const i18n = new LocalizationWrapper(
      page,
      (options.locale ?? "en") as SupportedLocale
    );

    try {
      const config = this.getLoginConfig();
      await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });

      await this.runLoginFlow(page, i18n, credentials);
      await this.handleOtpIfPresent(page, options);

      if (config.postLoginUrlPattern) {
        await page.waitForURL(config.postLoginUrlPattern, { timeout: 60_000 });
      }

      const loggedIn = await this.isLoggedIn(page);
      if (!loggedIn) {
        throw new Error(
          `Login failed for ${this.marketplaceId} — session not verified`
        );
      }

      const store = this.resolveSessionStore(options);
      const sessionPath = await store.save(context, this.marketplaceId);

      return {
        marketplaceId: this.marketplaceId,
        success: true,
        sessionPath,
        message: "Authenticated and session saved",
        reusedSession: false,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  protected resolveSessionStore(options: BrowserAuthOptions): SessionStore {
    return options.sessionsDir
      ? new SessionStore(options.sessionsDir)
      : this.sessionStore;
  }

  protected async launchBrowser(options: BrowserAuthOptions): Promise<Browser> {
    return chromium.launch({
      headless: options.headless ?? true,
      slowMo: options.slowMo,
    });
  }

  protected async newContext(
    browser: Browser,
    options: BrowserAuthOptions,
    storageState?: string
  ): Promise<BrowserContext> {
    const context = await browser.newContext({
      storageState,
      locale: options.locale ?? "en-US",
    });
    context.setDefaultTimeout(options.defaultTimeoutMs ?? 30_000);
    return context;
  }
}
