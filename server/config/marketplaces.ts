/**
 * Canonical multi-marketplace publish configuration.
 */

export type MarketplaceApiType = "rest" | "graph" | "web";
export type MarketplaceAuthType = "oauth" | "api_key" | "none";

export type MarketplaceConfig = {
  name: string;
  displayName: string;
  enabled: boolean;
  api: MarketplaceApiType;
  auth?: MarketplaceAuthType;
};

export const MARKETPLACES: MarketplaceConfig[] = [
  {
    name: "ebay",
    displayName: "eBay",
    enabled: true,
    api: "rest",
    auth: "oauth",
  },
  {
    name: "allegro",
    displayName: "Allegro",
    enabled: true,
    api: "rest",
    auth: "oauth",
  },
  {
    name: "facebook",
    displayName: "Facebook Marketplace",
    enabled: true,
    api: "graph",
    auth: "oauth",
  },
  {
    name: "poshmark",
    displayName: "Poshmark",
    enabled: false,
    api: "web",
    auth: "none",
  },
  {
    name: "mercari",
    displayName: "Mercari",
    enabled: false,
    api: "web",
    auth: "none",
  },
  {
    name: "offerup",
    displayName: "OfferUp",
    enabled: false,
    api: "web",
    auth: "none",
  },
];

const byName = new Map(MARKETPLACES.map((m) => [m.name, m]));

export function getMarketplaceConfig(name: string): MarketplaceConfig | undefined {
  return byName.get(name.toLowerCase());
}

export function getEnabledMarketplaceIds(): string[] {
  return MARKETPLACES.filter((m) => m.enabled).map((m) => m.name);
}

export function isMarketplaceEnabled(name: string): boolean {
  return getMarketplaceConfig(name)?.enabled === true;
}

/** Resolve requested names → enabled IDs; uses DEFAULT_PUBLISH_MARKETPLACES when empty. */
export function resolveMarketplaceTargets(requested?: string[]): string[] {
  const defaults =
    process.env.DEFAULT_PUBLISH_MARKETPLACES?.split(",").map((s) => s.trim()) ??
    getEnabledMarketplaceIds();

  const raw =
    requested && requested.length > 0
      ? requested.map((s) => s.trim().toLowerCase()).filter(Boolean)
      : defaults;

  const resolved: string[] = [];
  for (const id of raw) {
    const cfg = getMarketplaceConfig(id);
    if (!cfg) {
      console.warn(`[Marketplaces] Unknown marketplace "${id}" — skipped`);
      continue;
    }
    if (!cfg.enabled) {
      console.warn(
        `[Marketplaces] "${id}" is disabled (${cfg.api} only) — skipped`
      );
      continue;
    }
    resolved.push(cfg.name);
  }
  return [...new Set(resolved)];
}

export const SUPPORTED_MARKETPLACE_IDS = MARKETPLACES.map((m) => m.name);
