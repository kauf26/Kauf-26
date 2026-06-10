/**
 * One-tap OAuth — re-exports unified service (Etsy, eBay, Shopify + all OAuth marketplaces).
 * @see unifiedMarketplaceOAuth.ts
 */
export {
  connectMarketplaceOneTap,
  connectMarketplace,
  oneTapHelpText,
  getOAuthRedirectUri,
  OAUTH_REDIRECT_URIS,
  type ConnectOptions,
} from './unifiedMarketplaceOAuth';
