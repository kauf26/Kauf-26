/**
 * @deprecated Import from `src/masterMarketplaces.ts` (re-exports server config).
 */
export {
  MASTER_MARKETPLACES,
  SUPPORTED_MARKETPLACE_IDS,
  getEnabledMarketplaceIds,
  getMarketplaceConfig,
  type MasterMarketplace,
} from "./masterMarketplaces";

import { SUPPORTED_MARKETPLACE_IDS } from "./masterMarketplaces";

export type MarketplaceId = (typeof SUPPORTED_MARKETPLACE_IDS)[number];
