import type { NavigatorScreenParams } from '@react-navigation/native';
import type { IdentifyEditPayload, MarketplaceListingPayload } from './identify';

export type PublishOutcome = {
  marketplace: string;
  success: boolean;
  listingId?: string;
  listingUrl?: string;
  account?: string;
  message: string;
  dryRun?: boolean;
  error?: string;
};

export type PublishReport = {
  draftId?: number;
  jobId?: number;
  title?: string;
  marketplaces?: string[];
  outcomes?: PublishOutcome[];
  succeeded?: number;
  failed?: number;
  dryRun?: number;
};

export type HomeStackParamList = {
  Identify: undefined;
  Edit: { result: IdentifyEditPayload };
  SelectMarketplaces: { draftId: number; listing: MarketplaceListingPayload };
  PublishConfirmation: { report: PublishReport };
  Inventory: { draftId?: number };
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Login: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Upload: undefined;
  Listings: undefined;
  Inventory: { draftId?: number } | undefined;
  SoldProducts: undefined;
  Sales: undefined;
  Connections: undefined;
  Settings: undefined;
  Tools: undefined;
};
