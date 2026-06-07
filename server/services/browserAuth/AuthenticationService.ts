import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { BaseAuthStrategy } from "./BaseAuthStrategy";
import { SessionStore } from "./sessionStore";
import type { BrowserSessionData } from "./SessionStorageService";
import type { IUserSessionStore } from "./userSessionStore";
import type {
  AuthResult,
  BrowserAuthOptions,
  IAuthStrategy,
  MarketplaceId,
} from "./types";

type SessionBackend = SessionStore | IUserSessionStore;

function isUserSessionStore(store: SessionBackend): store is IUserSessionStore {
  return typeof (store as IUserSessionStore).listMarketplaceIds === "function";
}

/**
 * Strategy registry + page-level authenticate.
 *
 * Pass a `UserSessionStore` + `userId` for encrypted per-user DB persistence,
 * or the default filesystem `SessionStore` for local scripts.
 */
export class AuthenticationService {
  private readonly strategies = new Map<MarketplaceId, IAuthStrategy>();

  constructor(
    private readonly sessionStore: SessionBackend = new SessionStore(),
    private readonly defaultUserId?: number
  ) {}

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

  async authenticateWithSession(
    marketplaceId: MarketplaceId,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult> {
    const strategy = this.strategies.get(marketplaceId);
    if (!strategy) {
      throw new Error(`No strategy for ${marketplaceId}`);
    }

    const userId = options.userId ?? this.defaultUserId;
    const store = options.sessionsDir
      ? new SessionStore(options.sessionsDir)
      : this.sessionStore;

    const useUserStore = isUserSessionStore(store);
    if (useUserStore && userId == null) {
      throw new Error("userId is required when using UserSessionStore");
    }

    let storageState: BrowserSessionData | string | undefined;
    if (useUserStore && userId != null) {
      storageState = await store.storageStateFor(userId, marketplaceId);
    } else if (!useUserStore) {
      storageState = await (store as SessionStore).storageStateFor(marketplaceId);
    }

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
          const sessionPath = useUserStore
            ? `db:${userId}:${marketplaceId}`
            : (store as SessionStore).pathFor(marketplaceId);
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

      let sessionPath: string;
      if (useUserStore && userId != null) {
        await store.save(userId, context, marketplaceId);
        sessionPath = `db:${userId}:${marketplaceId}`;
      } else {
        sessionPath = await (store as SessionStore).save(context, marketplaceId);
      }

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

  /**
   * On return login: verify / warm all stored marketplace sessions for a user.
   */
  async restoreAllSessions(
    userId: number,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult[]> {
    if (!isUserSessionStore(this.sessionStore)) {
      throw new Error("restoreAllSessions requires UserSessionStore");
    }

    const marketplaceIds = await this.sessionStore.listMarketplaceIds(userId);
    const results: AuthResult[] = [];

    for (const marketplaceId of marketplaceIds) {
      if (!this.has(marketplaceId)) {
        results.push({
          marketplaceId,
          success: true,
          sessionPath: `db:${userId}:${marketplaceId}`,
          message: "Session stored (no strategy registered to verify)",
          reusedSession: true,
        });
        continue;
      }

      try {
        const result = await this.authenticateWithSession(marketplaceId, {
          ...options,
          userId,
        });
        results.push(result);
      } catch (err) {
        results.push({
          marketplaceId,
          success: false,
          sessionPath: `db:${userId}:${marketplaceId}`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  async sessionExists(
    marketplaceId: MarketplaceId,
    userId?: number
  ): Promise<boolean> {
    if (isUserSessionStore(this.sessionStore)) {
      const uid = userId ?? this.defaultUserId;
      if (uid == null) return false;
      return this.sessionStore.exists(uid, marketplaceId);
    }
    return (this.sessionStore as SessionStore).exists(marketplaceId);
  }

  sessionPath(marketplaceId: MarketplaceId, userId?: number): string {
    if (isUserSessionStore(this.sessionStore)) {
      const uid = userId ?? this.defaultUserId;
      return `db:${uid}:${marketplaceId}`;
    }
    return (this.sessionStore as SessionStore).pathFor(marketplaceId);
  }

  private async newContext(
    browser: Browser,
    options: BrowserAuthOptions,
    storageState?: BrowserSessionData | string
  ): Promise<BrowserContext> {
    const context = await browser.newContext({
      storageState,
      locale: options.locale ?? "en-US",
    });
    context.setDefaultTimeout(options.defaultTimeoutMs ?? 30_000);
    return context;
  }
}
