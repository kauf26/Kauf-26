/**
 * @deprecated Use oauthConnectionStorage — re-exports for legacy imports.
 */
export {
  saveMarketplaceTokens,
  loadMarketplaceTokens,
  deleteMarketplaceTokens,
  listMarketplaceConnections,
  hasMarketplaceConnection,
  saveConnectionTokens,
  loadConnectionTokens,
  deleteConnectionTokens,
  listConnections,
  hasConnection,
  type StoredConnectionTokens,
} from "./oauthConnectionStorage";

export type StoredMarketplaceTokens = import("./oauthConnectionStorage").StoredConnectionTokens;

export function isSupportedMarketplaceAuth(id: string): boolean {
  return ["etsy", "ebay", "shopify", "amazon"].includes(id.toLowerCase());
}
