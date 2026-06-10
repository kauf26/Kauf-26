/**
 * Provider registry for Connections UI — all 26 marketplaces.
 */
import { MARKETPLACE_OAUTH_MANIFEST } from '../../../shared/marketplaceOAuthManifest';
import type { MarketplaceOAuthProviderConfig } from '../../../shared/marketplaceOAuthTypes';
import type { ProviderDisplayMeta } from '../types/marketplaceConnect';
import { fetchOAuthProviders } from './oauthConfig';

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

export async function loadProviderRegistry(): Promise<{
  providers: ProviderDisplayMeta[];
  configured: MarketplaceOAuthProviderConfig[];
}> {
  const remote = await fetchOAuthProviders();
  const byId = new Map(remote.map((p) => [p.id, p]));

  const providers: ProviderDisplayMeta[] = MARKETPLACE_OAUTH_MANIFEST.map((entry) => {
    const remoteEntry = byId.get(entry.id);
    return {
      id: entry.id,
      name: entry.name,
      color: MARKETPLACE_COLORS[entry.id] ?? '#3b82f6',
      oauthSupported: entry.oauthSupported,
      configured: remoteEntry?.configured ?? false,
      requiresShopDomain: entry.requiresShopDomain,
      requiresSiteUrl: entry.requiresSiteUrl,
      requiresBaseUrl: entry.requiresBaseUrl,
      notes: entry.notes,
    };
  });

  const configured = remote.filter((p) => p.configured);
  return { providers, configured };
}
