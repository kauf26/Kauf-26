import type { SessionStore } from "./sessionStore";
import { SessionStore as DefaultSessionStore } from "./sessionStore";
import type {
  AuthCredentials,
  AuthResult,
  BrowserAuthOptions,
  MarketplaceAuthenticator,
  MarketplaceId,
} from "./types";

/**
 * Strategy registry — one authenticator per marketplace.
 *
 * ```ts
 * const auth = new AuthenticationService();
 * auth.register(new EbayAuthenticator());
 * auth.register(new StandardLoginAuthenticator("allegro", { ... }, {}, check));
 *
 * const result = await auth.authenticate("ebay", { email, password });
 * ```
 */
export class AuthenticationService {
  private readonly strategies = new Map<MarketplaceId, MarketplaceAuthenticator>();

  constructor(private readonly sessionStore: SessionStore = new DefaultSessionStore()) {}

  register(authenticator: MarketplaceAuthenticator): this {
    this.strategies.set(authenticator.marketplaceId, authenticator);
    return this;
  }

  registerMany(authenticators: MarketplaceAuthenticator[]): this {
    for (const a of authenticators) this.register(a);
    return this;
  }

  get(marketplaceId: MarketplaceId): MarketplaceAuthenticator | undefined {
    return this.strategies.get(marketplaceId);
  }

  has(marketplaceId: MarketplaceId): boolean {
    return this.strategies.has(marketplaceId);
  }

  listMarketplaces(): MarketplaceId[] {
    return [...this.strategies.keys()];
  }

  async authenticate(
    marketplaceId: MarketplaceId,
    credentials: AuthCredentials,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult> {
    const strategy = this.strategies.get(marketplaceId);
    if (!strategy) {
      throw new Error(
        `No authenticator registered for "${marketplaceId}". ` +
          `Registered: ${this.listMarketplaces().join(", ") || "(none)"}`
      );
    }

    const merged: BrowserAuthOptions = {
      sessionsDir: options.sessionsDir ?? undefined,
      ...options,
    };

    return strategy.login(credentials, merged);
  }

  async restore(
    marketplaceId: MarketplaceId,
    options: BrowserAuthOptions = {}
  ): Promise<AuthResult | null> {
    const strategy = this.strategies.get(marketplaceId);
    if (!strategy) return null;
    return strategy.restoreSession(options);
  }

  async sessionExists(marketplaceId: MarketplaceId): Promise<boolean> {
    return this.sessionStore.exists(marketplaceId);
  }

  sessionPath(marketplaceId: MarketplaceId): string {
    return this.sessionStore.pathFor(marketplaceId);
  }
}
