# Render Environment Variables — Gathering Checklist

Use this alongside `render-env-production.txt`. Check boxes as you obtain and paste each value into **Render → kauf26-api → Environment**.

**Legend**
- `[ ]` = not done
- No secret values in this file — only variable names and where to get them
- **Render blueprint** = already defined in `render.yaml` (verify in dashboard)

---

## Service setup order (do these first)

- [ ] **1. Neon** — [console.neon.tech](https://console.neon.tech) → create project → copy `DATABASE_URL`
- [ ] **2. Generate secrets** — run `openssl rand -hex 32` twice (`SESSION_SECRET`, `SESSION_ENCRYPTION_KEY`)
- [ ] **3. Render** — deploy service, paste env vars, health check `/api/health`
- [ ] **4. DNS** — CNAME `api.kaufai.com` → Render (remove from Vercel)
- [ ] **5. Run migrations** — `npm run db:migrate` with Neon `DATABASE_URL` before first deploy

---

## MANDATORY — app won't start or is unsafe without these

### Core (fixed in render.yaml — verify values)

- [ ] `NODE_ENV` = `production` — [✓ Render blueprint]
- [ ] `PORT` = `2626` — [✓ Render blueprint]
- [ ] `APP_BASE_URL` = `https://api.kaufai.com` — [✓ Render blueprint]
- [ ] `CLIENT_URL` = `https://kaufai.com` — [✓ Render blueprint]
- [ ] `VITE_API_URL` = `https://api.kaufai.com` — [✓ Render blueprint]
- [ ] `MOCK_OAUTH_MODE` = `false` — [✓ Render blueprint]

### Database & session (you must paste)

- [ ] `DATABASE_URL` — Neon dashboard → Connection string → add `?sslmode=require` if missing
- [ ] `SESSION_SECRET` — generate: `openssl rand -hex 32`
- [ ] `SESSION_ENCRYPTION_KEY` — generate: `openssl rand -hex 32` (64 hex chars; required in production)

### Post-paste verification

- [ ] Ran `npm run db:migrate` against Neon `DATABASE_URL`
- [ ] `curl https://kauf26-api.onrender.com/api/health` returns OK
- [ ] `curl https://api.kaufai.com/api/health` returns OK (after DNS)

---

## HIGH — core features break without these

### AI / identify

- [ ] `OPENAI_API_KEY` — [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — [○ Render secret slot]

### User sign-in

- [ ] `APPLE_CLIENT_ID` = `com.kaufai.app` — [✓ Render blueprint]
- [ ] `GOOGLE_CLIENT_ID` — [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) — [○ Render secret slot]
- [ ] `GOOGLE_CLIENT_SECRET` — same OAuth client — [○ Render secret slot]
- [ ] Registered redirect: `https://api.kaufai.com/api/auth/google/callback`

### Apple Sign-In (native + web)

- [ ] `APPLE_TEAM_ID` — [Apple Developer → Membership](https://developer.apple.com/account#MembershipDetailsCard) — [+ add to Render]
- [ ] `APPLE_KEY_ID` — [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list) — [+ add to Render]
- [ ] `APPLE_PRIVATE_KEY` — download `.p8` once from Keys page — [+ add to Render]
- [ ] Registered redirect: `https://api.kaufai.com/api/auth/apple/callback`

### Etsy [live]

- [ ] `ETSY_CLIENT_ID` — [etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps) — [○ Render secret slot]
- [ ] `ETSY_CLIENT_SECRET` — same app page — [○ Render secret slot]
- [ ] Registered web callback: `https://api.kaufai.com/api/auth/callback`
- [ ] Registered mobile redirect: `kauf26://oauth/etsy`

### eBay [live]

- [ ] `EBAY_CLIENT_ID` — [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) Production App ID — [○ Render secret slot]
- [ ] `EBAY_CLIENT_SECRET` — Production Cert ID — [○ Render secret slot]
- [ ] `EBAY_SANDBOX` = `false` — [✓ Render blueprint]
- [ ] `EBAY_REDIRECT_URI` — eBay RuName string (User Tokens page)
- [ ] Registered web callback: `https://api.kaufai.com/api/auth/callback`
- [ ] Registered mobile redirect: `kauf26://oauth/ebay`
- [ ] `EBAY_MARKETPLACE_ID` — e.g. `EBAY_US` — [+ add to Render]
- [ ] `EBAY_CATEGORY_ID` — default listing category — [+ add to Render]
- [ ] `EBAY_FULFILLMENT_POLICY_ID` — eBay Seller Hub → Business policies
- [ ] `EBAY_PAYMENT_POLICY_ID` — eBay Seller Hub → Business policies
- [ ] `EBAY_RETURN_POLICY_ID` — eBay Seller Hub → Business policies

### Shopify [live]

- [ ] `SHOPIFY_CLIENT_ID` — [partners.shopify.com](https://partners.shopify.com) → Apps — [○ Render secret slot]
- [ ] `SHOPIFY_CLIENT_SECRET` — same app — [○ Render secret slot]
- [ ] `SHOPIFY_SHOP_DOMAIN` — e.g. `your-store.myshopify.com` — [+ add to Render]
- [ ] `SHOPIFY_APP_BASE_URL` = `https://api.kaufai.com` — [+ add to Render]
- [ ] `SHOPIFY_OAUTH_REDIRECT_URI` = `https://api.kaufai.com/api/auth/callback` — [+ add to Render]
- [ ] `SHOPIFY_OAUTH_SCOPES` = `read_products,write_products` — [optional override]
- [ ] Registered redirect in Shopify Partners dashboard

### Allegro [live — not in render.yaml]

- [ ] `ALLEGRO_CLIENT_ID` — [developer.allegro.pl/my/application](https://developer.allegro.pl/my/application) — [+ add to Render]
- [ ] `ALLEGRO_CLIENT_SECRET` — same page — [+ add to Render]
- [ ] Registered web callback: `https://api.kaufai.com/api/auth/callback`
- [ ] Registered mobile redirect: `kauf26://oauth/allegro`

### OAuth verification (after keys pasted)

- [ ] `GET /api/marketplaces/oauth-config` shows configured providers
- [ ] Test connect flow for at least one marketplace from mobile app

---

## MEDIUM — optional features or degraded without these

### Session hardening

- [ ] `SESSION_SECRET` — if not done in MANDATORY section (strongly recommended)

### Billing (Stripe)

- [ ] `STRIPE_SECRET_KEY` — [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) — [○ Render secret slot]
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe → Webhooks → `https://api.kaufai.com/api/stripe/webhook` — [○ Render secret slot]
- [ ] Stripe test keys (`sk_test_...`) OK until real billing

### Scrapers (better identify / price research)

- [ ] `APIFY_API_KEY` — [console.apify.com](https://console.apify.com) → Integrations — [○ Render secret slot]
- [ ] `UNIFIED_API_KEY` — [app.unified.to](https://app.unified.to) — [○ Render secret slot]

### Publish & trial tuning

- [ ] `DEFAULT_PUBLISH_MARKETPLACES` — e.g. `ebay,etsy,shopify,allegro`
- [ ] `TRIAL_START_DATE` — e.g. `2026-06-12`
- [ ] `AUTO_QUEUE_PUBLISH` — default `false`
- [ ] `PUBLISH_MAX_ATTEMPTS` — default `3`
- [ ] `PUBLISH_RATE_LIMIT_MS` — default `2000`

### Etsy / eBay / Shopify optional overrides

- [ ] `ETSY_SHOP_ID`
- [ ] `ETSY_TAXONOMY_ID` — default `1`
- [ ] `ETSY_REDIRECT_URI` — only if overriding default
- [ ] `ETSY_OAUTH_SCOPES` — only if overriding default
- [ ] `EBAY_APP_ID` — alias for `EBAY_CLIENT_ID`
- [ ] `EBAY_CERT_ID` — alias for `EBAY_CLIENT_SECRET`
- [ ] `EBAY_DEV_ID`
- [ ] `EBAY_OAUTH_SCOPES`
- [ ] `EBAY_REFRESH_TOKEN` — legacy; per-user OAuth preferred
- [ ] `SHOPIFY_STORE_NAME`
- [ ] `SHOPIFY_STORE_DOMAIN` — alias for shop domain
- [ ] `SHOPIFY_ACCESS_TOKEN` — legacy static token
- [ ] `ALLEGRO_REDIRECT_URI` — only if overriding default

### Inventory sync

- [ ] `INVENTORY_POLL_ENABLED` — default `false`
- [ ] `INVENTORY_POLL_INTERVAL_MS` — default `300000`

### Identify tuning (defaults usually fine)

- [ ] `IDENTIFY_QUEUE_CONCURRENCY`
- [ ] `IDENTIFY_JOB_TIMEOUT_MS`
- [ ] `IDENTIFY_REQUEST_TIMEOUT_MS`
- [ ] `VISION_TIMEOUT_MS`
- [ ] `IDENTIFY_DEBUG` — set `false` or omit in production
- [ ] `SCRAPE_DEBUG` — set `false` or omit in production
- [ ] `JSON_BODY_LIMIT` — default `50mb`

---

## LOW — nice to have / future platforms

### Extra scraper sources

- [ ] `GOOGLE_API_KEY` — Google Cloud Console → Custom Search API
- [ ] `GOOGLE_CX` — [programmablesearchengine.google.com](https://programmablesearchengine.google.com)
- [ ] `OXYLABS_USERNAME` — [oxylabs.io](https://oxylabs.io)
- [ ] `OXYLABS_PASSWORD` — oxylabs.io dashboard
- [ ] `RAPIDAPI_KEY` — [rapidapi.com](https://rapidapi.com)
- [ ] `RAPIDAPI_EBAY_HOST` — optional override
- [ ] `RAPIDAPI_EBAY_PATH` — optional override
- [ ] `APIFY_ACTOR_ID`
- [ ] `APIFY_GOOGLE_LENS_ACTOR_ID`
- [ ] `APIFY_GOOGLE_SEARCH_ACTOR_ID`
- [ ] `APIFY_RUN_TIMEOUT_SECS`
- [ ] `APIFY_SCRAPER_TIMEOUT_MS`
- [ ] `SCRAPE_BUDGET_MS`
- [ ] `SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS`
- [ ] `SCRAPER_RACE_WINDOW_MS`
- [ ] `SCRAPER_RACE_TIMEOUT_MS`
- [ ] `GOOGLE_LENS_TIMEOUT_SECS`
- [ ] `GOOGLE_LENS_TIMEOUT_MS`
- [ ] `GOOGLE_SHOPPING_TIMEOUT_MS`
- [ ] `PRODUCT_PAGE_FETCH_TIMEOUT_MS`
- [ ] `KEYWORD_STAGE_MIN_BUDGET_MS`
- [ ] `EXACT_MATCH_MIN_RANK`

### Translation

- [ ] `LIBRETRANSLATE_URL` — hosted LibreTranslate or Docker sidecar
- [ ] `TRANSLATE_TIMEOUT_MS`

### Shipping & email

- [ ] `SHIPPING_FROM_NAME`
- [ ] `SHIPPING_FROM_LINE1`
- [ ] `SHIPPING_FROM_CITY`
- [ ] `SHIPPING_FROM_STATE`
- [ ] `SHIPPING_FROM_ZIP`
- [ ] `EASYPOST_API_KEY` — [easypost.com](https://www.easpost.com)
- [ ] `SHIPPO_API_KEY` — [goshippo.com](https://goshippo.com)
- [ ] `USPS_WEB_TOOLS_USER_ID` — [usps.com/business/web-tools-apis](https://www.usps.com/business/web-tools-apis/)
- [ ] `FEDEX_CLIENT_ID` — [developer.fedex.com](https://developer.fedex.com)
- [ ] `FEDEX_CLIENT_SECRET`
- [ ] `FEDEX_ACCOUNT_NUMBER`
- [ ] `FEDEX_API_BASE_URL` — prod: `https://apis.fedex.com`
- [ ] `UPS_CLIENT_ID` — [developer.ups.com](https://developer.ups.com)
- [ ] `UPS_CLIENT_SECRET`
- [ ] `UPS_ACCOUNT_NUMBER`
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_SECURE`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `SMTP_FROM`

### Advanced / internal

- [ ] `MARKETPLACE_RULES_PATH` — override eligibility rules file path
- [ ] `BROWSER_AUTH_HEADLESS` — documented only; not used by server code

### Dry-run / stub marketplaces (set only if enabling)

#### Amazon
- [ ] `AMAZON_CLIENT_ID`
- [ ] `AMAZON_CLIENT_SECRET`
- [ ] `AMAZON_REDIRECT_URI`
- [ ] `AMAZON_REFRESH_TOKEN`
- [ ] `AMAZON_SELLER_ID`
- [ ] `AMAZON_MARKETPLACE_ID`
- [ ] `AMAZON_SANDBOX`

#### AliExpress
- [ ] `ALIEXPRESS_APP_KEY`
- [ ] `ALIEXPRESS_APP_SECRET`

#### BigCommerce
- [ ] `BIGCOMMERCE_STORE_HASH`
- [ ] `BIGCOMMERCE_ACCESS_TOKEN`

#### Bol.com
- [ ] `BOLCOM_CLIENT_ID`
- [ ] `BOLCOM_CLIENT_SECRET`

#### Depop
- [ ] `DEPOP_API_KEY`

#### Flipkart
- [ ] `FLIPKART_APP_ID`
- [ ] `FLIPKART_APP_SECRET`

#### Fruugo
- [ ] `FRUUGO_API_KEY`
- [ ] `FRUUGO_MERCHANT_ID`

#### Lazada
- [ ] `LAZADA_APP_KEY`
- [ ] `LAZADA_APP_SECRET`

#### Magento
- [ ] `MAGENTO_BASE_URL`
- [ ] `MAGENTO_ACCESS_TOKEN`

#### Mercado Libre
- [ ] `MERCADOLIBRE_CLIENT_ID`
- [ ] `MERCADOLIBRE_CLIENT_SECRET`
- [ ] `MERCADOLIBRE_REFRESH_TOKEN`
- [ ] `MERCADOLIBRE_SITE_ID`
- [ ] `MERCADOLIBRE_CATEGORY_ID`
- [ ] `MERCADOLIBRE_CURRENCY`
- [ ] `MERCADOLIBRE_BR_SITE_ID`

#### Newegg
- [ ] `NEWEGG_SELLER_ID`
- [ ] `NEWEGG_API_KEY`

#### Poshmark
- [ ] `POSHMARK_PARTNERSHIP_KEY`

#### Rakuten
- [ ] `RAKUTEN_SERVICE_SECRET`
- [ ] `RAKUTEN_LICENSE_KEY`

#### Shopee
- [ ] `SHOPEE_PARTNER_ID`
- [ ] `SHOPEE_PARTNER_KEY`
- [ ] `SHOPEE_SHOP_ID`

#### StockX
- [ ] `STOCKX_API_KEY`

#### Taobao
- [ ] `TAOBAO_APP_KEY`
- [ ] `TAOBAO_APP_SECRET`

#### TikTok Shop
- [ ] `TIKTOKSHOP_APP_KEY`
- [ ] `TIKTOKSHOP_APP_SECRET`

#### Vinted
- [ ] `VINTED_API_KEY`

#### Wayfair
- [ ] `WAYFAIR_CLIENT_ID`
- [ ] `WAYFAIR_CLIENT_SECRET`

#### WooCommerce
- [ ] `WOOCOMMERCE_SITE_URL`
- [ ] `WOOCOMMERCE_CONSUMER_KEY`
- [ ] `WOOCOMMERCE_CONSUMER_SECRET`

#### Zalando
- [ ] `ZALANDO_CLIENT_ID`
- [ ] `ZALANDO_CLIENT_SECRET`

---

## NOT FOR RENDER — mobile EAS build-time only

Set in `mobile/eas.json` production profile or EAS Secrets (not Render):

- [ ] `EXPO_PUBLIC_API_URL` = `https://api.kaufai.com`
- [ ] `EXPO_PUBLIC_WEB_BASE_URL` = `https://kaufai.com`
- [ ] `EXPO_PUBLIC_PRIVACY_URL` — optional override
- [ ] `EXPO_PUBLIC_TERMS_URL` — optional override
- [ ] `APP_ENV` = `production` — set in eas.json

---

## Staging shortcuts (OK temporarily)

Use these to go live faster; swap to production values later:

- [ ] eBay sandbox: separate staging Render service with `EBAY_SANDBOX=true` + sandbox keys
- [ ] Stripe: `sk_test_...` and test `whsec_...` until real billing
- [ ] FedEx: `FEDEX_API_BASE_URL=https://apis-sandbox.fedex.com`
- [ ] Omit scraper keys (`APIFY`, `GOOGLE_CX`, `OXYLABS`, `RAPIDAPI`) until identify tuning
- [ ] Omit all dry-run marketplace blocks until those platforms launch

**Never on production Render:** `MOCK_OAUTH_MODE=true`

---

## Final sign-off

- [ ] All MANDATORY items checked
- [ ] At least one live marketplace (Etsy / eBay / Shopify) fully configured
- [ ] Health endpoint returns 200 on Render URL and custom domain
- [ ] Mobile production build points at `https://api.kaufai.com`
- [ ] OAuth redirect URIs registered in each marketplace portal used
