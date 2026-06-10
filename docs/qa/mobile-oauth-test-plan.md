# Mobile OAuth — QA Test Plan (15 tests)

Use this checklist before production merge. Requires a **development or production build** — Expo Go cannot receive `kauf26://` redirects.

**Setup docs:** [mobile-oauth-redirect-setup.md](../mobile-oauth-redirect-setup.md)

**Automated pre-flight (run first):**

```bash
npm test -- shared/
cd mobile && npx tsc --noEmit
```

---

## Pre-test setup

- [ ] iOS device/simulator (iOS 14+)
- [ ] Android device/emulator (Android 6+)
- [ ] Test accounts for at least 5 OAuth marketplaces (Etsy, eBay, Shopify, Amazon, Shopee) with saved credentials in **Safari** (iOS) and **Chrome** (Android)
- [ ] Test accounts with **no** saved credentials (fallback login path)
- [ ] Server `.env` with client IDs for test marketplaces (or mocked `GET /api/marketplaces/oauth-config`)
- [ ] Mobile build with `EXPO_PUBLIC_*` secrets for test marketplaces (`mobile/.env.example`)
- [ ] Redirect URI `kauf26://oauth/{marketplace_id}` registered in each marketplace developer dashboard

---

## Core one-tap flow (OAuth marketplaces)

### Test 1: Saved credentials in browser — one tap, no typing

| Marketplace | Action | Expected |
|-------------|--------|----------|
| Etsy | Tap **Connect Etsy — one tap** | Browser shows “Continue as [username]” → one tap → return to app → name/email auto-filled |
| eBay | Same | One tap → token on device → profile auto-filled |
| Shopify | Same (enter store domain first) | One tap → works |
| Amazon | Same | One tap → works |
| Shopee | Same | One tap → works |
| Allegro or MercadoLibre | Same | Success |

- [ ] Pass / Fail: ___________

### Test 2: No saved credentials — normal OAuth login, no password stored by app

- [ ] Clear browser cookies / saved passwords for one test marketplace
- [ ] Tap **Connect** → system browser shows full login form
- [ ] Enter credentials manually → authorize → return to app
- [ ] Token stored on device; profile auto-filled
- [ ] **Verify:** server logs show **no** user OAuth token storage (no backend `/oauth/token` for user tokens)

- [ ] Pass / Fail: ___________

### Test 3: User cancels OAuth — clean error and fallback UI

- [ ] Tap **Connect** → when browser opens, tap **Cancel** / close sheet
- [ ] App shows banner: **“Connection cancelled”**
- [ ] No partial token stored (marketplace still “Not connected”)
- [ ] User can tap Connect again without restart

- [ ] Pass / Fail: ___________

### Test 4: App closed mid-OAuth — no crash, can retry

- [ ] Tap **Connect** → while browser is open, force-close the app
- [ ] Reopen app → no crash
- [ ] Marketplace shows not connected (or completes if cold-started from redirect)
- [ ] Tap Connect again → flow works normally

- [ ] Pass / Fail: ___________

---

## Background / resume handling

### Test 5: App sent to background during OAuth (iOS & Android)

- [ ] Tap **Connect** → when browser opens, press **Home** (background app)
- [ ] Return to app (resume)
- [ ] Acceptable outcomes: OAuth completes automatically, browser reappears, or friendly error + retry
- [ ] **iOS:** ASWebAuthenticationSession not falsely reported as “cancelled” due to backgrounding (check console if debugging)

- [ ] Pass / Fail: ___________

### Test 6: Multi-tasking switch between apps during OAuth

- [ ] Start OAuth → switch to Messages (or another app) → switch back
- [ ] OAuth browser still visible **or** app receives token — no crash

- [ ] Pass / Fail: ___________

---

## Redirect URI handling

### Test 7: Custom scheme `kauf26://oauth/{id}` works on both platforms

- [ ] **iOS:** `mobile/app.json` → `CFBundleURLSchemes` includes `kauf26` (generates Info.plist entries on build)
- [ ] **Android:** `mobile/app.json` → `intentFilters` with `scheme: kauf26`, `host: oauth` (generates AndroidManifest on build)
- [ ] After OAuth, app opens with URL e.g. `kauf26://oauth/etsy?code=...`
- [ ] App extracts `code` and exchanges for token on device

- [ ] Pass / Fail: ___________

### Test 8: Incorrect or malformed redirect URI

- [ ] Set wrong redirect in server `.env` (e.g. `ETSY_REDIRECT_URI=kauf26://oauth/wrong`)
- [ ] Tap Connect → error: **“Redirect URI mismatch – check developer portal”**
- [ ] No token stored

- [ ] Pass / Fail: ___________

---

## Non-OAuth marketplaces (10)

### Test 9: Partnership / API-key marketplaces show correct UI

Marketplaces: **Depop, Fruugo, Magento, Newegg, Poshmark, Rakuten, StockX, TikTok Shop, Vinted, WooCommerce**

- [ ] Each shows informational card (partnership or API key message)
- [ ] **No** Connect button that attempts OAuth
- [ ] Viewing cards does not crash

- [ ] Pass / Fail: ___________

---

## Token storage & security

### Test 10: Tokens stored only on device, never on server

- [ ] After successful OAuth, server logs show no user token persistence
- [ ] Tokens in SecureStore (iOS Keychain / Android Keystore)
- [ ] After uninstall/reinstall, tokens are gone — user must reconnect

- [ ] Pass / Fail: ___________

### Test 11: Token refresh (Etsy 90-day refresh token)

- [ ] For Etsy: simulate or wait for access token expiry
- [ ] App uses refresh token automatically **or** prompts re-auth — no crash

- [ ] Pass / Fail: ___________

---

## UI & messaging

### Test 12: Connections screen shows all 26 marketplaces

- [ ] Scroll list — **26** cards total (**16** OAuth + **10** non-OAuth)
- [ ] OAuth + server client ID configured → active **Connect — one tap** button
- [ ] OAuth + not configured → gray **Configure server OAuth first**
- [ ] Non-OAuth → info only, no Connect button

- [ ] Pass / Fail: ___________

### Test 13: Profile auto-fill after OAuth

- [ ] Name and email pre-filled from marketplace user-info API
- [ ] User can edit fields before saving
- [ ] Missing email (e.g. some eBay tokens) → empty field, no crash

- [ ] Pass / Fail: ___________

---

## Error handling

### Test 14: Network failure during OAuth

- [ ] Start OAuth → enable airplane mode before redirect completes
- [ ] App shows **“Network error, please try again”**
- [ ] No partial token stored

- [ ] Pass / Fail: ___________

### Test 15: Marketplace returns error (invalid scope, etc.)

- [ ] Use wrong scopes in server config for one marketplace
- [ ] App shows descriptive error from marketplace response
- [ ] User can retry

- [ ] Pass / Fail: ___________

---

## Documentation verification

- [ ] `docs/mobile-oauth-redirect-setup.md` includes redirect URI table for all 26 marketplaces
- [ ] Developer portal checklists accurate (spot-check Etsy, eBay, Shopify)
- [ ] Native scheme whitelisting matches `mobile/app.json` (iOS Info.plist / Android intent-filter via Expo prebuild)
- [ ] `EXPO_PUBLIC_*` and server `.env` documented in `.env.example` and `mobile/.env.example`

---

## Regression checks

- [ ] Etsy, eBay, Shopify one-tap flows unchanged (no degradation)
- [ ] Web onboarding shows mobile-only message — no marketplace password fields
- [ ] Web Settings shows mobile connect guidance for OAuth marketplaces
- [ ] No server-side OAuth token routes (`server/*OAuthRoutes.ts` removed)

---

## Sign-off

| Tested by | Date | Platform | Result |
|-----------|------|----------|--------|
| | | iOS | Pass / Fail |
| | | Android | Pass / Fail |

**Known issues:**

---

## Ready to commit?

- [ ] Yes
- [ ] No — explain:

---

## Agent fix commands (if a test fails)

Examples:

- `Fix redirect resume on Android for Amazon OAuth — see test case 5`
- `Fix “Connection cancelled” UI on iOS dismiss gesture — see test case 3`
