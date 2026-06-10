# Mobile OAuth — Redirect URI setup (26 marketplaces)

One-tap marketplace connect uses custom-scheme deep links. Every OAuth request uses **`kauf26://oauth/{marketplace_id}`** — defined in `shared/oauthRedirect.ts` and `shared/marketplaceOAuthManifest.ts`.

Unified mobile service: **`mobile/src/services/unifiedMarketplaceOAuth.ts`**  
Provider registry: **`shared/marketplaceOAuthRegistry.ts`**  
Public API config: **`GET /api/marketplaces/oauth-config`** → `{ providers: [...26], configured: [...] }`

---

## All 26 redirect URIs

| ID | Name | Redirect URI | OAuth one-tap |
|----|------|--------------|---------------|
| aliexpress | AliExpress | `kauf26://oauth/aliexpress` | Yes |
| allegro | Allegro | `kauf26://oauth/allegro` | Yes |
| amazon | Amazon | `kauf26://oauth/amazon` | Yes |
| bigcommerce | BigCommerce | `kauf26://oauth/bigcommerce` | Yes |
| bolcom | Bol.com | `kauf26://oauth/bolcom` | Yes |
| depop | Depop | `kauf26://oauth/depop` | Partnership only |
| ebay | eBay | `kauf26://oauth/ebay` | Yes (live) |
| etsy | Etsy | `kauf26://oauth/etsy` | Yes (live) |
| flipkart | Flipkart | `kauf26://oauth/flipkart` | Yes |
| fruugo | Fruugo | `kauf26://oauth/fruugo` | API key only |
| lazada | Lazada | `kauf26://oauth/lazada` | Yes |
| magento | Magento | `kauf26://oauth/magento` | Integration token |
| mercadolibre | MercadoLibre | `kauf26://oauth/mercadolibre` | Yes |
| mercadolibre_br | Mercado Livre (BR) | `kauf26://oauth/mercadolibre_br` | Yes |
| newegg | Newegg | `kauf26://oauth/newegg` | API key only |
| poshmark | Poshmark | `kauf26://oauth/poshmark` | Partnership only |
| rakuten | Rakuten | `kauf26://oauth/rakuten` | API key only |
| shopee | Shopee | `kauf26://oauth/shopee` | Yes |
| shopify | Shopify | `kauf26://oauth/shopify` | Yes (live) |
| stockx | StockX | `kauf26://oauth/stockx` | Partnership only |
| taobao | Taobao | `kauf26://oauth/taobao` | Yes |
| tiktokshop | TikTok Shop | `kauf26://oauth/tiktokshop` | Partnership only |
| vinted | Vinted | `kauf26://oauth/vinted` | Partnership only |
| wayfair | Wayfair | `kauf26://oauth/wayfair` | Yes |
| woocommerce | WooCommerce | `kauf26://oauth/woocommerce` | REST keys (wp-admin) |
| zalando | Zalando | `kauf26://oauth/zalando` | Yes |

Register each URI in the marketplace developer portal even if OAuth is not yet enabled — keeps redirect validation consistent.

---

## Native app configuration

### iOS — Info.plist (ASWebAuthenticationSession)

Expo generates URL scheme handling from `mobile/app.json`. We also declare:

```json
"ios": {
  "infoPlist": {
    "CFBundleURLTypes": [
      {
        "CFBundleURLName": "kauf26.oauth",
        "CFBundleURLSchemes": ["kauf26"]
      }
    ]
  }
}
```

After changing `app.json`, run a **new native build** (`eas build --platform ios`). Expo Go does **not** use the `kauf26` scheme — use a development or production build for OAuth testing.

When the marketplace redirects to `kauf26://oauth/etsy?code=...`, iOS opens the app and `ASWebAuthenticationSession` completes via `WebBrowser.maybeCompleteAuthSession()`.

### Android — AndroidManifest.xml (Chrome Custom Tabs)

In `mobile/app.json`:

```json
"android": {
  "intentFilters": [
    {
      "action": "VIEW",
      "data": [{ "scheme": "kauf26", "host": "oauth" }],
      "category": ["BROWSABLE", "DEFAULT"]
    }
  ]
}
```

This whitelists `kauf26://oauth/*` so Chrome Custom Tabs can return to the app. Rebuild the APK/AAB after changes.

---

## Etsy — developer checklist

1. Open [Etsy Developers](https://www.etsy.com/developers/your-apps) → your app.
2. **OAuth redirect URIs** → Add **`kauf26://oauth/etsy`** (exact string, no trailing slash).
3. Copy **Keystring** → server `.env` as `ETSY_CLIENT_ID`.
4. Confirm scopes include `email_r` (for profile auto-fill) plus listing/shop scopes.
5. Verify server returns the same URI: `GET /api/marketplaces/oauth-config` → `marketplaces[].redirectUri` for `etsy`.

---

## Shopify — developer checklist

1. Open [Shopify Partners](https://partners.shopify.com) → Apps → your app → **Configuration**.
2. **Allowed redirection URL(s)** → Add **`kauf26://oauth/shopify`**.
3. Copy **Client ID** → `SHOPIFY_CLIENT_ID` in server `.env`.
4. Copy **Client secret** → `EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET` in mobile build env (device-only token exchange).
5. Merchant enters store domain in the app before connect (e.g. `your-store.myshopify.com`).
6. Confirm `GET /api/marketplaces/oauth-config` shows `redirectUri: "kauf26://oauth/shopify"`.

---

## eBay — developer checklist

1. Open [eBay Developer Program](https://developer.ebay.com/my/keys) → your application.
2. **OAuth Redirect URIs (RuName)** → Add **`kauf26://oauth/ebay`**.
   - For sandbox testing, register the same URI on the sandbox key set if separate.
3. Copy **App ID (Client ID)** → `EBAY_CLIENT_ID` in server `.env`.
4. Copy **Cert ID (Client Secret)** → `EXPO_PUBLIC_EBAY_CLIENT_SECRET` in mobile build env.
5. Enable scopes including `commerce.identity.readonly` (profile auto-fill) and sell scopes.
6. Set `EBAY_SANDBOX=true` in `.env` for sandbox; auth URLs switch automatically.
7. Confirm `GET /api/marketplaces/oauth-config` shows `redirectUri: "kauf26://oauth/ebay"`.

**Platform notes:** Android uses Chrome Custom Tabs (same redirect handling as eBay’s OAuth Android client). iOS uses `ASWebAuthenticationSession`.

---

## Shopify — developer checklist (extended)

**Optional iOS advanced:** Configure Shopify `MobilePlatformApplication` + universal links for shared web credentials (see [Shopify mobile auth docs](https://shopify.dev/docs/apps/build/authentication-authorization)). Custom scheme `kauf26://oauth/shopify` remains the default for one-tap connect.

---

## Other OAuth marketplaces — quick setup

For each OAuth-supported marketplace below, register **`kauf26://oauth/{id}`** in the developer portal and set the matching `{ENV}_CLIENT_ID` in server `.env`. Set `EXPO_PUBLIC_{ID}_CLIENT_SECRET` in mobile build env when token exchange requires a secret (see `shared/marketplaceOAuthManifest.ts`).

| Marketplace | Developer portal | Server env (client id) |
|-------------|------------------|------------------------|
| Allegro | [developer.allegro.pl](https://developer.allegro.pl) | `ALLEGRO_CLIENT_ID` |
| Amazon | [Seller Central Developer Console](https://sellercentral.amazon.com/sellingpartner/developerconsole) | `AMAZON_CLIENT_ID` |
| AliExpress | [openservice.aliexpress.com](https://openservice.aliexpress.com) | `ALIEXPRESS_APP_KEY` |
| BigCommerce | [developer.bigcommerce.com](https://developer.bigcommerce.com) | `BIGCOMMERCE_CLIENT_ID` |
| Bol.com | [developer.bol.com](https://developer.bol.com) | `BOLCOM_CLIENT_ID` |
| Flipkart | [seller.flipkart.com](https://seller.flipkart.com) | `FLIPKART_APP_ID` |
| Lazada | [open.lazada.com](https://open.lazada.com) | `LAZADA_APP_KEY` |
| MercadoLibre | [developers.mercadolibre.com](https://developers.mercadolibre.com) | `MERCADOLIBRE_CLIENT_ID` |
| Mercado Livre BR | [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br) | `MERCADOLIBRE_CLIENT_ID` (same app, different redirect) |
| Shopee | [open.shopee.com](https://open.shopee.com) | `SHOPEE_PARTNER_ID` |
| Taobao | [open.taobao.com](https://open.taobao.com) | `TAOBAO_APP_KEY` |
| Wayfair | [developer.wayfair.com](https://developer.wayfair.com) | `WAYFAIR_CLIENT_ID` |
| Zalando | [partner.zalando.com](https://partner.zalando.com) | `ZALANDO_CLIENT_ID` |

**Non-OAuth marketplaces (Connections UI shows info only):** Depop, Fruugo, Magento, Newegg, Poshmark, Rakuten, StockX, TikTok Shop, Vinted, WooCommerce — require partnership approval or merchant-issued API keys.

---

## Background / resume behaviour

Implemented in `mobile/src/services/oauthSessionLifecycle.ts`:

- Calls `WebBrowser.maybeCompleteAuthSession()` on app launch, when returning to foreground, and when a `kauf26://oauth/...` deep link arrives.
- Handles cold start after the user completes OAuth in the browser while the app was killed.

OAuth uses **system browser only** (`preferEphemeralSession: false`):

- **iOS**: shared Safari / Keychain session (one-tap when already logged in).
- **Android**: Chrome Custom Tabs with `warmUpAsync` / `coolDownAsync` for reliable tab lifecycle.

---

## Manual test scenarios

Use a **development or production build** (not Expo Go).

| Scenario | Expected result |
|----------|-----------------|
| Saved password / active browser session | One tap → Allow → connected; name/email auto-filled |
| No saved session | Full marketplace login in system browser; tokens on device only |
| User cancels / dismisses auth sheet | Inline notice on Connections screen; tap Connect to retry |
| App backgrounded mid-OAuth | Return to app or tap redirect → session completes; no crash |
| App killed mid-OAuth | Open app from redirect link → session completes; or retry Connect |
| Redirect URI mismatch in `.env` | Clear error before OAuth starts |

Run automated checks (26-marketplace registry + redirect URIs):

```bash
npm test -- shared/
```

Mobile TypeScript check:

```bash
cd mobile && npx tsc --noEmit
```

## Test report (simulated)

**Manual QA checklist:** [docs/qa/mobile-oauth-test-plan.md](qa/mobile-oauth-test-plan.md)

Automated tests in `shared/marketplaceOAuthRegistry.test.ts`, `shared/oauthRedirect.test.ts`, and `shared/qa/oauthQAChecks.test.ts`:

| Check | Result |
|-------|--------|
| Manifest contains 26 marketplaces | Pass |
| Each marketplace redirect URI = `kauf26://oauth/{id}` | Pass |
| Etsy / eBay / Shopify configured when env set | Pass |
| Partnership marketplaces marked `oauthSupported: false` | Pass |
| Live marketplaces have HTTPS auth/token URLs | Pass |
| 16 OAuth-supported + 10 partnership/API-key | Pass |

Real-device OAuth requires marketplace developer credentials. Use a **dev/production build** (not Expo Go) per marketplace as credentials become available.

---

- **No server token storage** — OAuth tokens live in Expo SecureStore on the device only.
- **No embedded WebView** — ASWebAuthenticationSession (iOS) and Chrome Custom Tabs (Android) only.
- **No marketplace passwords** collected by Kauf26 — users sign in via the system browser.
