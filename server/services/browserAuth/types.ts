import type { Browser, BrowserContext, Page } from "playwright";

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
  sessionsDir?: string;
  locale?: string;
  /** When the marketplace prompts for 2FA after password entry. */
  otp?: OtpResolution;
};

export type AuthenticatorContext = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  marketplaceId: MarketplaceId;
  locale: string;
};

export type AuthResult = {
  marketplaceId: MarketplaceId;
  success: boolean;
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

export interface MarketplaceAuthenticator {
  readonly marketplaceId: MarketplaceId;
  login(
    credentials: AuthCredentials,
    options?: BrowserAuthOptions
  ): Promise<AuthResult>;
  restoreSession(options?: BrowserAuthOptions): Promise<AuthResult | null>;
  isLoggedIn(page: Page): Promise<boolean>;
}
