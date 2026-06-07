import { mkdir, access, constants } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext } from "playwright";
import type { MarketplaceId } from "./types";

const DEFAULT_SESSIONS_DIR = path.join(process.cwd(), ".browser-sessions");

export class SessionStore {
  constructor(private readonly sessionsDir: string = DEFAULT_SESSIONS_DIR) {}

  pathFor(marketplaceId: MarketplaceId): string {
    const safe = marketplaceId.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    return path.join(this.sessionsDir, `${safe}.json`);
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  async exists(marketplaceId: MarketplaceId): Promise<boolean> {
    try {
      await access(this.pathFor(marketplaceId), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pass return value to `browser.newContext({ storageState })` to restore session.
   */
  async storageStateFor(
    marketplaceId: MarketplaceId
  ): Promise<string | undefined> {
    return (await this.exists(marketplaceId))
      ? this.pathFor(marketplaceId)
      : undefined;
  }

  /** Persist cookies + per-origin localStorage via Playwright storageState. */
  async save(
    context: BrowserContext,
    marketplaceId: MarketplaceId
  ): Promise<string> {
    await this.ensureDir();
    const file = this.pathFor(marketplaceId);
    await context.storageState({ path: file });
    return file;
  }
}
