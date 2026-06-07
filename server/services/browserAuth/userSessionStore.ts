import type { BrowserContext } from "playwright";
import {
  SessionStorageService,
  type BrowserSessionData,
} from "./SessionStorageService";
import type { MarketplaceId } from "./types";

/**
 * IUserSessionStore — user-scoped persistence for AuthenticationService.
 * Wraps SessionStorageService (encrypted PostgreSQL).
 */
export interface IUserSessionStore {
  exists(userId: number, marketplaceId: MarketplaceId): Promise<boolean>;
  storageStateFor(
    userId: number,
    marketplaceId: MarketplaceId
  ): Promise<BrowserSessionData | undefined>;
  save(
    userId: number,
    context: BrowserContext,
    marketplaceId: MarketplaceId
  ): Promise<void>;
  listMarketplaceIds(userId: number): Promise<MarketplaceId[]>;
}

export class UserSessionStore implements IUserSessionStore {
  constructor(
    private readonly storage: SessionStorageService = new SessionStorageService()
  ) {}

  async exists(userId: number, marketplaceId: MarketplaceId): Promise<boolean> {
    return this.storage.hasSession(userId, marketplaceId);
  }

  async storageStateFor(
    userId: number,
    marketplaceId: MarketplaceId
  ): Promise<BrowserSessionData | undefined> {
    const data = await this.storage.loadSession(userId, marketplaceId);
    return data ?? undefined;
  }

  async save(
    userId: number,
    context: BrowserContext,
    marketplaceId: MarketplaceId
  ): Promise<void> {
    const state = (await context.storageState()) as BrowserSessionData;
    await this.storage.saveSession(userId, marketplaceId, state);
  }

  async listMarketplaceIds(userId: number): Promise<MarketplaceId[]> {
    return this.storage.listMarketplaceIds(userId);
  }
}
