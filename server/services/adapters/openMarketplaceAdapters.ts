/**
 * Open REST adapters for secondary marketplaces (dry-run until credentials are set).
 */
import type { DraftPublishPayload } from "../../publishToMarketplaces";
import type { MarketplaceAdapter } from "./types";
import { baseOpenPayload, createOpenRestAdapter } from "./openRestAdapter";
import { env } from "./adapterUtils";

function spec(
  id: string,
  displayName: string,
  envKeys: string[],
  buildApiBody: (draft: DraftPublishPayload) => Record<string, unknown>,
  publishUrl: (formatted: Record<string, unknown>) => string,
  headers?: (formatted: Record<string, unknown>) => Record<string, string>
) {
  return createOpenRestAdapter({
    id,
    displayName,
    envKeys,
    missingCredsMessage: `${displayName} credentials missing — dry run only`,
    buildPayload: (draft) => {
      const base = baseOpenPayload(draft, id);
      return { ...base, apiBody: buildApiBody(draft) };
    },
    publishUrl: (formatted) => publishUrl(formatted),
    buildHeaders: headers,
    extractListingId: (json) => {
      const o = json as Record<string, unknown>;
      const idVal = o.id ?? o.listing_id ?? o.product_id;
      return idVal != null ? String(idVal) : undefined;
    },
  });
}

export const openMarketplaceAdapters: MarketplaceAdapter[] = [
  spec(
    "aliexpress",
    "AliExpress",
    ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "aliexpress").price,
      description: baseOpenPayload(draft, "aliexpress").description,
    }),
    () => "https://api-sg.aliexpress.com/sync"
  ),
  spec(
    "bigcommerce",
    "BigCommerce",
    ["BIGCOMMERCE_STORE_HASH", "BIGCOMMERCE_ACCESS_TOKEN"],
    (draft) => ({
      name: draft.title,
      price: baseOpenPayload(draft, "bigcommerce").price,
      description: baseOpenPayload(draft, "bigcommerce").description,
      sku: baseOpenPayload(draft, "bigcommerce").sku,
    }),
    () =>
      `https://api.bigcommerce.com/stores/${env("BIGCOMMERCE_STORE_HASH")}/v3/catalog/products`,
    () => ({ "X-Auth-Token": env("BIGCOMMERCE_ACCESS_TOKEN") })
  ),
  spec(
    "shopee",
    "Shopee",
    ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID"],
    (draft) => ({
      item_name: draft.title,
      description: baseOpenPayload(draft, "shopee").description,
      original_price: baseOpenPayload(draft, "shopee").price,
      item_sku: baseOpenPayload(draft, "shopee").sku,
    }),
    () =>
      `https://partner.shopeemobile.com/api/v2/product/add_item?partner_id=${env("SHOPEE_PARTNER_ID")}&shop_id=${env("SHOPEE_SHOP_ID")}`
  ),
  spec(
    "bolcom",
    "Bol.com",
    ["BOLCOM_CLIENT_ID", "BOLCOM_CLIENT_SECRET"],
    (draft) => ({
      title: draft.title,
      description: baseOpenPayload(draft, "bolcom").description,
      price: baseOpenPayload(draft, "bolcom").price,
      stock: 1,
    }),
    () => "https://api.bol.com/retailer/offers"
  ),
  spec(
    "flipkart",
    "Flipkart",
    ["FLIPKART_APP_ID", "FLIPKART_APP_SECRET"],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "flipkart").price,
      sku: baseOpenPayload(draft, "flipkart").sku,
    }),
    () => "https://api.flipkart.net/sellers/v2/products"
  ),
  spec(
    "fruugo",
    "Fruugo",
    ["FRUUGO_API_KEY", "FRUUGO_MERCHANT_ID"],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "fruugo").price,
      description: baseOpenPayload(draft, "fruugo").description,
    }),
    () => "https://api.fruugo.com/v1/products",
    () => ({ Authorization: `Bearer ${env("FRUUGO_API_KEY")}` })
  ),
  spec(
    "lazada",
    "Lazada",
    ["LAZADA_APP_KEY", "LAZADA_APP_SECRET"],
    (draft) => ({
      name: draft.title,
      price: baseOpenPayload(draft, "lazada").price,
      description: baseOpenPayload(draft, "lazada").description,
    }),
    () => "https://api.lazada.com/rest/product/create"
  ),
  spec(
    "magento",
    "Magento",
    ["MAGENTO_BASE_URL", "MAGENTO_ACCESS_TOKEN"],
    (draft) => ({
      product: {
        sku: baseOpenPayload(draft, "magento").sku,
        name: draft.title,
        price: baseOpenPayload(draft, "magento").price,
        status: 2,
      },
    }),
    () => {
      const base = env("MAGENTO_BASE_URL").replace(/\/$/, "");
      return `${base}/rest/V1/products`;
    },
    () => ({ Authorization: `Bearer ${env("MAGENTO_ACCESS_TOKEN")}` })
  ),
  spec(
    "mercadolibre_br",
    "Mercado Livre Brazil",
    [
      "MERCADOLIBRE_CLIENT_ID",
      "MERCADOLIBRE_CLIENT_SECRET",
      "MERCADOLIBRE_REFRESH_TOKEN",
      "MERCADOLIBRE_BR_SITE_ID",
    ],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "mercadolibre_br").price,
      currency_id: "BRL",
      site_id: env("MERCADOLIBRE_BR_SITE_ID") || "MLB",
    }),
    () => "https://api.mercadolibre.com/items"
  ),
  spec(
    "newegg",
    "Newegg",
    ["NEWEGG_SELLER_ID", "NEWEGG_API_KEY"],
    (draft) => ({
      ItemNumber: baseOpenPayload(draft, "newegg").sku,
      SellingPrice: baseOpenPayload(draft, "newegg").price,
      Description: baseOpenPayload(draft, "newegg").description,
    }),
    () => "https://api.newegg.com/marketplace/itemmanagement"
  ),
  spec(
    "rakuten",
    "Rakuten",
    ["RAKUTEN_SERVICE_SECRET", "RAKUTEN_LICENSE_KEY"],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "rakuten").price,
      description: baseOpenPayload(draft, "rakuten").description,
    }),
    () => "https://api.rms.rakuten.co.jp/es/2.0/items/manage-numbers"
  ),
  spec(
    "taobao",
    "Taobao",
    ["TAOBAO_APP_KEY", "TAOBAO_APP_SECRET"],
    (draft) => ({
      title: draft.title,
      price: baseOpenPayload(draft, "taobao").price,
      description: baseOpenPayload(draft, "taobao").description,
    }),
    () => "https://eco.taobao.com/router/rest"
  ),
  spec(
    "wayfair",
    "Wayfair",
    ["WAYFAIR_CLIENT_ID", "WAYFAIR_CLIENT_SECRET"],
    (draft) => ({
      name: draft.title,
      price: baseOpenPayload(draft, "wayfair").price,
      description: baseOpenPayload(draft, "wayfair").description,
    }),
    () => "https://api.wayfair.com/v1/product-catalog-api/products"
  ),
  spec(
    "zalando",
    "Zalando",
    ["ZALANDO_CLIENT_ID", "ZALANDO_CLIENT_SECRET"],
    (draft) => ({
      name: draft.title,
      price: baseOpenPayload(draft, "zalando").price,
      description: baseOpenPayload(draft, "zalando").description,
    }),
    () => "https://api.zalando.com/products"
  ),
];
