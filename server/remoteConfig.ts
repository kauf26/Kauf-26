// Local defaults until Firebase Remote Config is wired (firebase-admin not in package.json).

export interface RemoteConfigs {
  ebay_integration_enabled: boolean;
  shopify_sync_interval: number;
  max_listings_free_tier: number;
  commission_rate: number;
}

const DEFAULT_CONFIGS: RemoteConfigs = {
  ebay_integration_enabled: true,
  shopify_sync_interval: 5000,
  max_listings_free_tier: 10,
  commission_rate: 0.1,
};

export class ConfigService {
  private static instance: ConfigService;

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public async get<K extends keyof RemoteConfigs>(key: K): Promise<RemoteConfigs[K]> {
    return DEFAULT_CONFIGS[key];
  }
}
