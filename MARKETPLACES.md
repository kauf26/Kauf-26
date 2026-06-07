# Kauf26 Marketplace Publishing

**Single source of truth:** `server/config/marketplaces.ts` (`MASTER_MARKETPLACES` — **26 platforms**)

**Publish engine:** `server/services/publishEngine.ts`  
**Adapters:** `server/services/adapters/`  
**CLI:** `npm run kauft -- publish-all <draftId>`  
**API:** `POST /api/marketplaces/publish-all` `{ "draftId": 123 }`

---

## Approved platforms (26)

| ID | Name | API method | Status |
|----|------|------------|--------|
| aliexpress | AliExpress | open | dry-run |
| allegro | Allegro | open | **live** |
| amazon | Amazon | open | dry-run |
| bigcommerce | BigCommerce | open | dry-run |
| bolcom | Bol.com | open | dry-run |
| depop | Depop | partnership | partnership-stub |
| ebay | eBay | open | **live** |
| etsy | Etsy | open | dry-run |
| flipkart | Flipkart | open | dry-run |
| fruugo | Fruugo | open | dry-run |
| lazada | Lazada | open | dry-run |
| magento | Magento (Adobe Commerce) | open | dry-run |
| mercadolibre | MercadoLibre | open | dry-run |
| mercadolibre_br | Mercado Livre (Brazil) | open | dry-run |
| newegg | Newegg | open | dry-run |
| poshmark | Poshmark | partnership | partnership-stub |
| rakuten | Rakuten | open | dry-run |
| shopee | Shopee | open | dry-run |
| shopify | Shopify | open | dry-run |
| stockx | StockX | partnership | partnership-stub |
| taobao | Taobao | open | dry-run |
| tiktokshop | TikTok Shop | partnership | partnership-stub |
| vinted | Vinted | partnership | partnership-stub |
| wayfair | Wayfair | open | dry-run |
| woocommerce | WooCommerce | open | dry-run |
| zalando | Zalando | open | dry-run |

Unknown marketplace IDs are **skipped** with a warning (`resolveMarketplaceTargets`).

---

## API endpoints

```http
POST /api/marketplaces/publish
{ "draftId": 123, "marketplaceIds": ["ebay", "etsy"], "sync": true }

POST /api/marketplaces/publish-all
{ "draftId": 123, "sync": false }

GET /api/marketplaces/config
GET /api/marketplaces/status/:jobId
```

`GET /api/marketplaces/config` returns all 26 marketplace definitions with `envConfigured` flags.

---

## CLI

```bash
npm run kauft -- publish-all 112
npm run kauft -- publish 112 --marketplaces amazon,etsy,shopify
npm run test:adapters -- --marketplaces ebay,allegro,stockx
```

---

## Defaults

`DEFAULT_PUBLISH_MARKETPLACES=ebay,allegro,amazon,etsy,shopify`
