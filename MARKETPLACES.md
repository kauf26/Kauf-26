# Kauf26 Marketplace Publishing

**Single source of truth:** `server/config/marketplaces.ts` (`MASTER_MARKETPLACES`)

**Publish engine:** `server/services/publishEngine.ts`  
**Adapters:** `server/services/adapters/`  
**CLI:** `npm run kauft -- publish-all <draftId>`  
**API:** `POST /api/marketplaces/publish-all` `{ "draftId": 123 }`

---

## Summary

| API method | Count | Behavior |
|------------|-------|----------|
| `open` | 18 | REST adapter; dry-run without env credentials |
| `partnership` | 9 | Stub — logs “Partnership API — manual listing required” |
| `web` | 0 in master list | Legacy `webAdapter` for unknown IDs |

All platforms have `enabledForPublishing: true` by default except **facebook** (disabled; catalog API kept for backward compatibility).

---

## Platform reference

| ID | Name | API | Status | Credentials (env) |
|----|------|-----|--------|-------------------|
| ebay | eBay | open | **live** | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN` |
| allegro | Allegro | open | **live** | `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET` |
| amazon | Amazon | open | dry-run | `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`, `AMAZON_SELLER_ID` |
| etsy | Etsy | open | dry-run | `ETSY_API_KEY`, `ETSY_CLIENT_ID`, `ETSY_REFRESH_TOKEN`, `ETSY_SHOP_ID` |
| shopify | Shopify | open | dry-run | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` |
| woocommerce | WooCommerce | open | dry-run | `WOOCOMMERCE_SITE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` |
| mercadolibre | Mercado Libre | open | dry-run | `MERCADOLIBRE_CLIENT_ID`, `MERCADOLIBRE_CLIENT_SECRET`, `MERCADOLIBRE_REFRESH_TOKEN` |
| discogs | Discogs | open | dry-run | `DISCOGS_API_TOKEN` |
| grailed | Grailed | open | dry-run | `GRAILED_API_KEY` |
| shopee | Shopee | open | dry-run | `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_SHOP_ID` |
| bolcom | Bol.com | open | dry-run | `BOLCOM_CLIENT_ID`, `BOLCOM_CLIENT_SECRET` |
| cdiscount | Cdiscount | open | dry-run | `CDISCOUNT_SELLER_ID`, `CDISCOUNT_API_KEY` |
| kidizen | Kidizen | open | dry-run | `KIDIZEN_API_KEY` |
| squarespace | Squarespace | open | dry-run | `SQUARESPACE_API_KEY` |
| wix | Wix eCommerce | open | dry-run | `WIX_API_KEY`, `WIX_SITE_ID` |
| prestashop | PrestaShop | open | dry-run | `PRESTASHOP_SITE_URL`, `PRESTASHOP_API_KEY` |
| pinterest | Pinterest | open | dry-run | `PINTEREST_ACCESS_TOKEN` |
| mercari | Mercari US | partnership | partnership-stub | `MERCARI_PARTNERSHIP_KEY` |
| mercari-jp | Mercari Japan | partnership | partnership-stub | `MERCARI_JP_PARTNERSHIP_KEY` |
| stockx | StockX | partnership | partnership-stub | `STOCKX_API_KEY` |
| whatnot | Whatnot | partnership | partnership-stub | `WHATNOT_API_KEY` |
| depop | Depop | partnership | partnership-stub | `DEPOP_API_KEY` |
| poshmark | Poshmark | partnership | partnership-stub | `POSHMARK_PARTNERSHIP_KEY` |
| tiktokshop | TikTok Shop | partnership | partnership-stub | `TIKTOKSHOP_APP_KEY`, `TIKTOKSHOP_APP_SECRET` |
| vinted | Vinted | partnership | partnership-stub | `VINTED_API_KEY` |
| falabella | Falabella | partnership | partnership-stub | `FALABELLA_API_KEY` |
| facebook | Facebook Marketplace | open | live (disabled) | `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_CATALOG_ID` |

---

## API endpoints

```http
POST /api/marketplaces/publish
{ "draftId": 123, "marketplaces": ["ebay", "etsy"], "sync": true }

POST /api/marketplaces/publish-all
{ "draftId": 123, "sync": false }

GET /api/marketplaces/status/:jobId
GET /api/marketplaces/config
```

---

## CLI

```bash
# All enabled marketplaces (26 by default)
npm run kauft -- publish-all 112

# Subset
npm run kauft -- publish 112 --marketplaces amazon,etsy,shopify

# Dry-run adapter payloads (no DB required)
npm run test:adapters
npm run test:adapters -- --marketplaces ebay,amazon,etsy,mercari
```

---

## Credentials

1. **Environment variables** (primary) — see `.env.example`
2. **Database** — `marketplace_credentials` table (`shared/schema.ts`) for per-user OAuth tokens (optional; env checked first via `server/services/marketplaceCredentials.ts`)

---

## Implementation notes

- **Parallel publish:** `Promise.allSettled` in `publishToMarketplacesParallel`
- **Jobs:** Each run creates `publish_jobs` + one `publish_tasks` row per marketplace
- **Dry-run:** When required env vars are missing, adapters log the payload and return success with `dryRun: true`
- **Amazon:** Uses SP-API Listings `PUT /listings/2021-08-01/items/{sellerId}/{sku}` (LWA token; AWS SigV4 not yet wired for production)
- **Partnership platforms:** No public seller API — stub returns dry-run success until partnership keys are integrated
- **Puppeteer / web automation:** Not implemented; use partnership stubs or manual export

---

## Tests

```bash
npm run test:publish    # publish engine unit tests
npm run test:adapters   # all adapter dry-run payloads
```
