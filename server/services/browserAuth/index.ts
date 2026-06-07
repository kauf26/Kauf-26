export { AuthenticationService } from "./AuthenticationService";
export { BaseAuthenticator, type LoginFlowConfig } from "./BaseAuthenticator";
export { LocalizationWrapper } from "./localization";
export { LocaleKey, LOCALE_PATTERNS, type SupportedLocale } from "./localeKeys";
export { DefaultOtpHandler } from "./otpHandler";
export { SessionStore } from "./sessionStore";
export { EbayAuthenticator } from "./strategies/EbayAuthenticator";
export {
  StandardLoginAuthenticator,
  type StandardLoginSelectors,
} from "./strategies/StandardLoginAuthenticator";
export type {
  AuthCredentials,
  AuthResult,
  BrowserAuthOptions,
  MarketplaceAuthenticator,
  MarketplaceId,
  OtpHandler,
  OtpResolution,
} from "./types";
