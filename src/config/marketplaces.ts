/**
 * @deprecated Import from `src/masterMarketplaces.ts` or `server/config/marketplaces.ts`.
 */
export {
  MASTER_MARKETPLACES as MARKETPLACES,
  type MasterMarketplace as MarketplaceDefinition,
  getEnabledMarketplaceIds,
  getMarketplaceConfig,
} from "../masterMarketplaces";

export type MarketplaceIntegrationType = "API" | "Manual";
