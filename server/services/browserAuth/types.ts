import type { Page } from "playwright";

/** Aligns with `server/config/marketplaces.ts` ids (ebay, amazon, shopify, …). */
export type MarketplaceId = string;

export type AuthCredentials = {
  email?: string;
  username?: string;
  password: string;
};

export type BrowserAuthOptions = {
  headless?: boolean;
  slowMo?: number;
  defaultTimeoutMs?: number;
  /** @deprecated Use userId + UserSessionStore instead of filesystem sessionsDir */
  sessionsDir?: string;
  locale?: string;
  /** Required for user-scoped encrypted session persistence. */
  userId?: number;
  /** When the marketplace prompts for 2FA after password entry. */
  otp?: OtpResolution;
};

export type AuthResult = {
  marketplaceId: MarketplaceId;
  success: boolean;
  /** Filesystem path (legacy) or `db:userId:marketplaceId` for user sessions */
  sessionPath: string;
  message: string;
  reusedSession?: boolean;
};

export type OtpRequest = {
  marketplaceId: MarketplaceId;
  page: Page;
  hint?: string;
};

export type OtpResolution =
  | { type: "totp"; secret: string }
  | { type: "manual"; waitForCode: () => Promise<string> }
  | { type: "inject"; code: string };

export interface OtpHandler {
  resolve(request: OtpRequest, resolution: OtpResolution): Promise<void>;
}

/**
 * Core strategy contract — page is owned by the caller or `authenticateWithSession`.
 */
export interface IAuthStrategy {
  readonly marketplaceId: MarketplaceId;
  login(page: Page): Promise<void>;
  isLoggedIn(page: Page): Promise<boolean>;
}
