import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { BaseAuthStrategy } from "./BaseAuthStrategy";
import { SessionStore } from "./sessionStore";
import type {
  AuthResult,
  BrowserAuthOptions,
  IAuthStrategy,
  MarketplaceId,
} from "./types";

/**
 * Strategy registry + page-level authenticate (your proposed API).
 *
 * ```ts
 * const auth = new AuthenticationService();
 * auth.registerStrategy("ebay", new EbayAuthStrategy({ email, password }));
 *
 * // Caller owns the page (e.g. from an existing scraper browser):
 * await auth.authenticate("ebay", page);
 *
 * // Or use full browser + session persistence:
 * const result = await auth.authenticateWithSession("ebay");
 * ```
 */
export class AuthenticationService {
  private readonly strategies = new Map<MarketplaceId, IAuthStrategy>();

  constructor(private readonly sessionStore: SessionStore = new SessionStore()) {}

  registerStrategy(marketplaceId: MarketplaceId, strategy: IAuthStrategy): this {
    this.strategies.set(marketplaceId, strategy);
    return this;
  }

  /** @deprecated Use registerStrategy */
  register(strategy: IAuthStrategy): this {
    return this.registerStrategy(strategy.marketplaceId, strategy);
  }

  getStrategy(marketplaceId: MarketplaceId): IAuthStrategy | undefined {
    return this.strategies.get(marketplaceId);
  }

  has(marketplaceId: MarketplaceId): boolean {
    return this.strategies.has(marketplaceId);
  }

  listMarketplaces(): MarketplaceId[] {
    return [...this.strategies.keys()];
  }

  /**
   * Page-level auth — checks persistence via `isLoggedIn`, then runs `login`.
   * Does not launch a browser or save cookies (caller handles that).
   */
  async authenticate(marketplaceId: MarketplaceId, page: Page): Promise<void> {
    const strategy = this.strategies.get(marketplaceId);
    if (!strategy) {
      throw new Error(
        `No strategy for ${marketplaceId}. ` +
          `Registered: ${this.listMarketplaces().join(", ") || "(none)"}`
      );
    }

    if (await strategy.isLoggedIn(page)) return;

    await strategy.login(page);
  }

  /**
   * Full flow: launch browser, restore session if present, authenticate, persist.
   */
  async authenticateWithSession(
    marketplaceId: MarketplaceId,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult> {
    const strategy = this.strategies.get(marketplaceId);
    if (!strategy) {
      throw new Error(`No strategy for ${marketplaceId}`);
    }

    const store = options.sessionsDir
      ? new SessionStore(options.sessionsDir)
      : this.sessionStore;

    const storageState = await store.storageStateFor(marketplaceId);
    const browser = await chromium.launch({
      headless: options.headless ?? true,
      slowMo: options.slowMo,
    });

    let context: BrowserContext | undefined;
    try {
      context = await this.newContext(browser, options, storageState);
      const page = await context.newPage();

      const verifyUrl =
        strategy instanceof BaseAuthStrategy
          ? strategy.verifyUrl()
          : "about:blank";

      if (storageState) {
        await page.goto(verifyUrl, { waitUntil: "domcontentloaded" });
        if (await strategy.isLoggedIn(page)) {
          const sessionPath = store.pathFor(marketplaceId);
          return {
            marketplaceId,
            success: true,
            sessionPath,
            message: "Restored persisted session",
            reusedSession: true,
          };
        }
      }

      await this.authenticate(marketplaceId, page);

      const sessionPath = await store.save(context, marketplaceId);
      return {
        marketplaceId,
        success: true,
        sessionPath,
        message: "Authenticated and session saved",
        reusedSession: false,
      };
    } finally {
      await context?.close();
      await browser.close();
    }
  }

  async sessionExists(marketplaceId: MarketplaceId): Promise<boolean> {
    return this.sessionStore.exists(marketplaceId);
  }

  sessionPath(marketplaceId: MarketplaceId): string {
    return this.sessionStore.pathFor(marketplaceId);
  }

  private async newContext(
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
