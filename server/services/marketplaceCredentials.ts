/**
 * Credential resolution: env vars first, then marketplace_credentials table.
 */
import { db } from "../db";
import { marketplaceCredentials } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  getMarketplaceConfig,
  type MasterMarketplace,
} from "../config/marketplaces";
import { env } from "./adapters/adapterUtils";
import { hasStoredTokens } from "./tokenStorage";

const OAUTH_MARKETPLACES = new Set(["etsy", "shopify", "ebay"]);

export function marketplaceEnvConfigured(marketplaceId: string): boolean {
  const cfg = getMarketplaceConfig(marketplaceId);
  if (!cfg) return false;
  return cfg.envKeys.every((key) => Boolean(env(key)));
}

export function getMarketplaceEnvSnapshot(
  marketplaceId: string
): Record<string, string> {
  const cfg = getMarketplaceConfig(marketplaceId);
  if (!cfg) return {};
  const out: Record<string, string> = {};
  for (const key of cfg.envKeys) {
    const value = env(key);
    if (value) {
      out[key] = value.length > 8 ? `${value.slice(0, 4)}…` : "***";
    }
  }
  return out;
}

export async function loadDbCredentials(
  marketplaceId: string
): Promise<Record<string, string> | null> {
  try {
    const [row] = await db
      .select()
      .from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, marketplaceId));
    if (!row?.credentials) return null;
    return JSON.parse(row.credentials) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function isMarketplaceConnected(
  marketplaceId: string
): Promise<boolean> {
  if (OAUTH_MARKETPLACES.has(marketplaceId)) {
    return hasStoredTokens(marketplaceId);
  }
  if (marketplaceEnvConfigured(marketplaceId)) return true;
  try {
    const [row] = await db
      .select()
      .from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, marketplaceId));
    return row?.connected === true;
  } catch {
    return false;
  }
}

export function describeCredentials(cfg: MasterMarketplace): string[] {
  return cfg.envKeys;
}
