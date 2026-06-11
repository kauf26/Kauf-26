/**
 * Provider registry for Connections UI — all 26 marketplaces from server/config/marketplaces.ts.
 */
import {
  MASTER_MARKETPLACES,
  SUPPORTED_MARKETPLACE_IDS,
} from '../../../server/config/marketplaces';
import {
  getOAuthManifestEntry,
  MARKETPLACE_OAUTH_MANIFEST_COUNT,
} from '../../../shared/marketplaceOAuthManifest';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import type { MarketplaceOAuthFlow } from '../../../shared/marketplaceOAuthTypes';
import type { ProviderDisplayMeta } from '../types/marketplaceConnect';
import {
  CREDENTIALS_NOT_CONFIGURED,
  isFullyConfiguredForConnect,
} from './auth';
import { fetchOAuthProvidersSafe } from './oauthConfig';

export const MARKETPLACE_COUNT = SUPPORTED_MARKETPLACE_IDS.length;

const MARKETPLACE_COLORS: Record<string, string> = {
  aliexpress: '#e43225',
  allegro: '#ff5a00',
  amazon: '#ff9900',
  bigcommerce: '#34313f',
  bolcom: '#0000ff',
  depop: '#ff2300',
  ebay: '#e53238',
  etsy: '#f45800',
  flipkart: '#2874f0',
  fruugo: '#003366',
  lazada: '#0f146d',
  magento: '#f26322',
  mercadolibre: '#ffe600',
  mercadolibre_br: '#ffe600',
  newegg: '#f59b00',
  poshmark: '#7b2869',
  rakuten: '#bf0000',
  shopee: '#ee4d2d',
  shopify: '#95bf47',
  stockx: '#006340',
  taobao: '#ff5000',
  tiktokshop: '#010101',
  vinted: '#09b1ba',
  wayfair: '#7b189f',
  woocommerce: '#96588a',
  zalando: '#ff6900',
};

function resolveAuthMethod(
  oauthFlow?: MarketplaceOAuthFlow
): ProviderDisplayMeta['authMethod'] {
  if (oauthFlow === 'partnership') return 'partnership';
  if (oauthFlow === 'api_key') return 'api_key';
  return 'oauth';
}

export function nonOAuthStatusMessage(oauthFlow: MarketplaceOAuthFlow): string {
  if (oauthFlow === 'partnership') {
    return 'Contact us for partnership access — mobile OAuth is not available for this marketplace.';
  }
  if (oauthFlow === 'api_key') {
    return 'API key required — configure credentials on the server (no mobile OAuth connect).';
  }
  return 'Mobile OAuth not available for this marketplace.';
}

export function authMethodLabel(method: ProviderDisplayMeta['authMethod']): string {
  switch (method) {
    case 'oauth':
      return 'OAuth';
    case 'api_key':
      return 'API key';
    case 'partnership':
      return 'Partnership';
  }
}

export async function loadProviderRegistry(): Promise<{
  providers: ProviderDisplayMeta[];
  configured: MarketplaceOAuthProviderConfig[];
  configWarning?: string;
}> {
  const { providers: remote, fromServer, error } = await fetchOAuthProvidersSafe();
  const byId = new Map(remote.map((p) => [p.id, p]));
  const masterById = new Map(MASTER_MARKETPLACES.map((m) => [m.id, m]));

  const providers: ProviderDisplayMeta[] = SUPPORTED_MARKETPLACE_IDS.map((id) => {
    const master = masterById.get(id);
    const entry = getOAuthManifestEntry(id);
    const remoteEntry = byId.get(id);
    const serverConfigured = remoteEntry?.configured ?? false;
    const oauthFlow = entry?.oauthFlow ?? 'api_key';

    return {
      id,
      name: master?.name ?? entry?.name ?? id,
      color: MARKETPLACE_COLORS[id] ?? '#3b82f6',
      oauthSupported: entry?.oauthSupported ?? false,
      oauthFlow,
      authMethod: resolveAuthMethod(oauthFlow),
      configured: isFullyConfiguredForConnect(id, serverConfigured),
      requiresShopDomain: entry?.requiresShopDomain,
      requiresSiteUrl: entry?.requiresSiteUrl,
      requiresBaseUrl: entry?.requiresBaseUrl,
      notes: entry?.notes,
      country: master?.country,
    };
  });

  const configured = remote.filter((p) =>
    isFullyConfiguredForConnect(p.id, p.configured)
  );

  const configWarning = !fromServer
    ? error ?? CREDENTIALS_NOT_CONFIGURED
    : undefined;

  if (__DEV__ && providers.length !== MARKETPLACE_OAUTH_MANIFEST_COUNT) {
    console.warn(
      `[providerRegistry] Marketplace count mismatch: master=${providers.length} manifest=${MARKETPLACE_OAUTH_MANIFEST_COUNT}`
    );
  }

  return { providers, configured, configWarning };
}
