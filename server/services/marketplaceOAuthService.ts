/**
 * @deprecated Use oauthService — re-exports for legacy imports.
 */
export {
  getAuthUrl,
  exchangeCode,
  refreshToken,
  revokeAccess,
  getValidAccessToken,
  getUnifiedOAuthRedirectUri,
  getLegacyOAuthRedirectUri,
  buildAuthorizeUrl,
  handleOAuthCallback,
  handleLegacyCallback,
  handleUnifiedCallback,
  disconnectMarketplace,
  oauthFailureRedirect,
  resolveOAuthUserId,
  listProviderConnectionStatus,
  isOAuthProviderConfigured,
  isUniversalOAuthProvider,
  isOAuthMarketplace,
  UNIVERSAL_OAUTH_PROVIDERS,
  type OAuthProviderId,
  type OAuthMarketplaceId,
  type TokenResponse,
  type OAuthConnectOptions,
} from "./oauthService";
