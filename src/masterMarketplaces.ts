/**
 * Re-export canonical marketplace list from server config (single source of truth).
 */
export {
  MASTER_MARKETPLACES,
  type MasterMarketplace,
  type MarketplaceApiMethod,
  type ImplementationStatus,
  getEnabledMarketplaceIds,
  getMarketplaceConfig,
  SUPPORTED_MARKETPLACE_IDS,
} from "../server/config/marketplaces";
