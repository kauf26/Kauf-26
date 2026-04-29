<<<<<<< HEAD
import { getRemoteConfig } from "firebase-admin/remote-config";

// 1. Define your configuration keys and their types
export interface RemoteConfigs {
 ebay_integration_enabled: boolean;
 shopify_sync_interval: number;
 max_listings_free_tier: number;
 commission_rate: number; // New Line Added
}

// 2. Set safe defaults in case the internet or Firebase fails
const DEFAULT_CONFIGS: RemoteConfigs = {
 ebay_integration_enabled: true,
 shopify_sync_interval: 5000,
 max_listings_free_tier: 10,
 commission_rate: 0.10, // New Line Added
};


export class ConfigService {
 private static instance: ConfigService;

 private constructor() {}

 // Singleton pattern to keep the connection efficient
 public static getInstance(): ConfigService {
   if (!ConfigService.instance) {
     ConfigService.instance = new ConfigService();
   }
   return ConfigService.instance;
 }

 /**
  * Fetches a value from Firebase Remote Config.
  * If it fails or the key is missing, it returns the local default.
  */
 public async get<K extends keyof RemoteConfigs>(key: K): Promise<RemoteConfigs[K]> {
   try {
     const template = await getRemoteConfig().getTemplate();
     const parameter = template.parameters[key];

     if (parameter && parameter.defaultValue) {
       // Firebase stores everything as strings, so we convert them back
       const rawValue = (parameter.defaultValue as any).value;

       if (typeof DEFAULT_CONFIGS[key] === 'number') {
         return Number(rawValue) as any;
       }
       if (typeof DEFAULT_CONFIGS[key] === 'boolean') {
         return (rawValue === 'true' || rawValue === true) as any;
       }
       return rawValue;
     }
   } catch (error) {
     // Log the error but don't crash the app; use the default instead
     console.error(`[RemoteConfig] Error fetching ${key}:`, error);
   }

   return DEFAULT_CONFIGS[key];
 }
}
=======
/**
* ConfigService handles remote configuration and platform-wide constants.
* Updated: April 2026
*/
export class ConfigService {
  /**
   * Returns the platform commission rate.
   * Based on the latest update, this is set to 2%.
   */
  static async getCommissionRate(): Promise<number> {
    // Current application logic requires a 2% commission rate
    return 2;
  }
 
  /**
   * Returns the trial period for new subscribers.
   * Updated from 30 days to 14 days to increase user urgency.
   */
  static getTrialPeriodDays(): number {
    return 14;
  }
 }
>>>>>>> 2054f48
