import { fetchOAuthConfigs } from './oauthConfig';
import {
  hasPlatformTokens,
  loadPlatformTokens,
  savePlatformTokens,
  type StoredPlatformTokens,
} from './secureTokenStore';

export type VerifyResult = {
  ok: boolean;
  message: string;
  accountName?: string;
};

export type PublishResult = {
  success: boolean;
  listingId?: string;
  listingUrl?: string;
  message: string;
};

const REFRESH_BUFFER_MS = 60_000;

async function getValidTokens(marketplace: string): Promise<StoredPlatformTokens> {
  const stored = await loadPlatformTokens(marketplace);
  if (!stored) throw new Error(`${marketplace} not connected`);
  if (stored.expiresAt > Date.now() + REFRESH_BUFFER_MS) return stored;

  if (!stored.refreshToken) {
    throw new Error(`${marketplace} token expired — reconnect in Connections`);
  }

  const configs = await fetchOAuthConfigs();
  const config = configs.find((c) => c.marketplace === marketplace);
  if (!config) throw new Error('OAuth config unavailable');

  let refreshed: StoredPlatformTokens;
  if (marketplace === 'etsy') {
    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: stored.refreshToken,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error_description ?? 'Etsy refresh failed');
    refreshed = {
      ...stored,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? stored.refreshToken,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
  } else if (marketplace === 'shopify' && stored.shopDomain) {
    throw new Error(`${marketplace} token expired — reconnect in Connections`);
  } else if (marketplace === 'ebay') {
    throw new Error(`${marketplace} token expired — reconnect in Connections`);
  } else {
    throw new Error('Cannot refresh token');
  }

  await savePlatformTokens(marketplace, refreshed);
  return refreshed;
}

export async function verifyMarketplace(marketplace: string): Promise<VerifyResult> {
  if (!(await hasPlatformTokens(marketplace))) {
    return { ok: false, message: 'Not connected' };
  }
  try {
    const tokens = await getValidTokens(marketplace);
    const configs = await fetchOAuthConfigs();
    const config = configs.find((c) => c.marketplace === marketplace);
    if (!config) return { ok: false, message: 'Config missing' };

    if (marketplace === 'etsy') {
      const res = await fetch('https://api.etsy.com/v3/application/users/me', {
        headers: {
          'x-api-key': config.clientId,
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      if (!res.ok) return { ok: false, message: `Etsy verify failed (${res.status})` };
      return {
        ok: true,
        message: 'Etsy connected',
        accountName: tokens.userName ?? tokens.accountName,
      };
    }

    if (marketplace === 'shopify' && tokens.shopDomain) {
      const res = await fetch(
        `https://${tokens.shopDomain}/admin/api/2024-10/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': tokens.accessToken,
            Accept: 'application/json',
          },
        }
      );
      if (!res.ok) return { ok: false, message: `Shopify verify failed (${res.status})` };
      const json = await res.json();
      return {
        ok: true,
        message: 'Shopify connected',
        accountName: tokens.userName ?? json.shop?.name ?? tokens.shopDomain,
      };
    }

    if (marketplace === 'ebay') {
      return {
        ok: true,
        message: 'eBay token valid',
        accountName: tokens.userName ?? tokens.accountName,
      };
    }

    return {
      ok: true,
      message: `${marketplace} connected`,
      accountName: tokens.userName ?? tokens.accountName,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Verify failed',
    };
  }
}

export async function publishListing(
  marketplace: string,
  listing: {
    title: string;
    description: string;
    price: number;
    sku?: string;
  }
): Promise<PublishResult> {
  const tokens = await getValidTokens(marketplace);
  const configs = await fetchOAuthConfigs();
  const config = configs.find((c) => c.marketplace === marketplace);
  if (!config) return { success: false, message: 'OAuth config missing' };

  if (marketplace === 'etsy') {
    const shopId = tokens.shopId;
    if (!shopId) {
      const me = await fetch('https://api.etsy.com/v3/application/users/me', {
        headers: {
          'x-api-key': config.clientId,
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      const meJson = await me.json();
      if (!meJson.shop_id) {
        return { success: false, message: 'No Etsy shop linked to this account' };
      }
      tokens.shopId = String(meJson.shop_id);
      await savePlatformTokens('etsy', tokens);
    }
    const res = await fetch(
      `https://api.etsy.com/v3/application/shops/${tokens.shopId}/listings`,
      {
        method: 'POST',
        headers: {
          'x-api-key': config.clientId,
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 1,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          who_made: 'someone_else',
          when_made: '2020_2025',
          taxonomy_id: 1,
          type: 'physical',
        }),
      }
    );
    const text = await res.text();
    if (!res.ok) return { success: false, message: text.slice(0, 200) };
    const json = JSON.parse(text);
    const listingId = String(json.listing_id ?? '');
    return {
      success: true,
      listingId,
      listingUrl: listingId ? `https://www.etsy.com/listing/${listingId}` : undefined,
      message: 'Etsy draft listing created',
    };
  }

  if (marketplace === 'shopify' && tokens.shopDomain) {
    const res = await fetch(
      `https://${tokens.shopDomain}/admin/api/2024-10/products.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': tokens.accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          product: {
            title: listing.title,
            body_html: listing.description,
            status: 'draft',
            variants: [
              {
                sku: listing.sku ?? `kauf-${Date.now()}`,
                price: listing.price.toFixed(2),
                inventory_quantity: 1,
              },
            ],
          },
        }),
      }
    );
    const text = await res.text();
    if (!res.ok) return { success: false, message: text.slice(0, 200) };
    const json = JSON.parse(text);
    const id = json.product?.id;
    return {
      success: true,
      listingId: id ? String(id) : undefined,
      listingUrl: id
        ? `https://${tokens.shopDomain}/admin/products/${id}`
        : undefined,
      message: 'Shopify draft product created',
    };
  }

  if (marketplace === 'ebay') {
    const sku = listing.sku ?? `kauf-${Date.now()}`;
    const base = config.tokenUrl.includes('sandbox') ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    };
    const invRes = await fetch(`${base}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        product: { title: listing.title, description: listing.description },
        condition: 'USED_GOOD',
        availability: { shipToLocationAvailability: { quantity: 1 } },
      }),
    });
    if (!invRes.ok) {
      return { success: false, message: await invRes.text().then((t) => t.slice(0, 200)) };
    }
    const offerRes = await fetch(`${base}/sell/inventory/v1/offer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        listingDescription: listing.description,
        availableQuantity: 1,
        categoryId: '93427',
        pricingSummary: {
          price: { value: listing.price.toFixed(2), currency: 'USD' },
        },
      }),
    });
    if (!offerRes.ok) {
      return { success: false, message: await offerRes.text().then((t) => t.slice(0, 200)) };
    }
    const offer = await offerRes.json();
    const pubRes = await fetch(`${base}/sell/inventory/v1/offer/${offer.offerId}/publish`, {
      method: 'POST',
      headers,
    });
    if (!pubRes.ok) {
      return { success: false, message: await pubRes.text().then((t) => t.slice(0, 200)) };
    }
    const published = await pubRes.json();
    return {
      success: true,
      listingId: published.listingId ?? offer.offerId,
      listingUrl: published.listingId
        ? `https://www.ebay.com/itm/${published.listingId}`
        : undefined,
      message: 'eBay listing published',
    };
  }

  return { success: false, message: 'Unsupported marketplace' };
}
