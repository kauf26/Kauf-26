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
    "discogs",
    "Discogs",
    ["DISCOGS_API_TOKEN"],
    (draft) => ({
      price: baseOpenPayload(draft, "discogs").price,
      condition: "Mint (M)",
      status: "Draft",
      comments: baseOpenPayload(draft, "discogs").description,
    }),
    () => "https://api.discogs.com/marketplace/listings",
    () => ({
      Authorization: `Discogs token=${env("DISCOGS_API_TOKEN")}`,
    })
  ),
  spec(
    "grailed",
    "Grailed",
    ["GRAILED_API_KEY"],
    (draft) => ({
      title: draft.title,
      description: baseOpenPayload(draft, "grailed").description,
      price: baseOpenPayload(draft, "grailed").price,
      size: "OS",
    }),
    () => "https://api.grailed.com/v1/listings",
    () => ({ Authorization: `Bearer ${env("GRAILED_API_KEY")}` })
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
    "cdiscount",
    "Cdiscount",
    ["CDISCOUNT_SELLER_ID", "CDISCOUNT_API_KEY"],
    (draft) => ({
      SellerProductId: baseOpenPayload(draft, "cdiscount").sku,
      ProductName: draft.title,
      Description: baseOpenPayload(draft, "cdiscount").description,
      Price: baseOpenPayload(draft, "cdiscount").price,
    }),
    () => "https://wsvc.cdiscount.com/MarketplaceAPIService.svc/json/CreateProduct"
  ),
  spec(
    "kidizen",
    "Kidizen",
    ["KIDIZEN_API_KEY"],
    (draft) => ({
      title: draft.title,
      description: baseOpenPayload(draft, "kidizen").description,
      price_cents: Math.round(Number(baseOpenPayload(draft, "kidizen").price) * 100),
    }),
    () => "https://api.kidizen.com/v1/listings",
    () => ({ Authorization: `Bearer ${env("KIDIZEN_API_KEY")}` })
  ),
  spec(
    "squarespace",
    "Squarespace",
    ["SQUARESPACE_API_KEY"],
    (draft) => ({
      type: "PHYSICAL",
      storePageId: env("SQUARESPACE_STORE_PAGE_ID"),
      name: draft.title,
      description: baseOpenPayload(draft, "squarespace").description,
      variants: [
        {
          sku: baseOpenPayload(draft, "squarespace").sku,
          pricing: {
            basePrice: {
              value: String(baseOpenPayload(draft, "squarespace").price),
              currency: "USD",
            },
          },
        },
      ],
    }),
    () => "https://api.squarespace.com/1.0/commerce/products",
    () => ({ Authorization: `Bearer ${env("SQUARESPACE_API_KEY")}` })
  ),
  spec(
    "wix",
    "Wix",
    ["WIX_API_KEY", "WIX_SITE_ID"],
    (draft) => ({
      product: {
        name: draft.title,
        description: baseOpenPayload(draft, "wix").description,
        priceData: { price: baseOpenPayload(draft, "wix").price },
        sku: baseOpenPayload(draft, "wix").sku,
      },
    }),
    () => `https://www.wixapis.com/stores/v1/products`,
    () => ({
      Authorization: env("WIX_API_KEY"),
      "wix-site-id": env("WIX_SITE_ID"),
    })
  ),
  spec(
    "prestashop",
    "PrestaShop",
    ["PRESTASHOP_SITE_URL", "PRESTASHOP_API_KEY"],
    (draft) => ({
      product: {
        name: [{ language: { id: 1 }, value: draft.title }],
        description: [
          {
            language: { id: 1 },
            value: baseOpenPayload(draft, "prestashop").description,
          },
        ],
        price: String(baseOpenPayload(draft, "prestashop").price),
        active: 0,
        reference: baseOpenPayload(draft, "prestashop").sku,
      },
    }),
    () => {
      const base = env("PRESTASHOP_SITE_URL").replace(/\/$/, "");
      return `${base}/api/products?ws_key=${env("PRESTASHOP_API_KEY")}`;
    },
    () => ({ "Content-Type": "application/json" })
  ),
  spec(
    "pinterest",
    "Pinterest",
    ["PINTEREST_ACCESS_TOKEN"],
    (draft) => ({
      title: draft.title,
      description: baseOpenPayload(draft, "pinterest").description,
      price: baseOpenPayload(draft, "pinterest").price,
      availability: "IN_STOCK",
    }),
    () => "https://api.pinterest.com/v5/catalogs/items",
    () => ({ Authorization: `Bearer ${env("PINTEREST_ACCESS_TOKEN")}` })
  ),
];
