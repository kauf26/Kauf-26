# Mobile OAuth — QA Test Plan

Use this checklist before release. Requires a **development or production build** (Expo Go cannot receive `kauf26://` redirects).

**Related docs:** [mobile-oauth-redirect-setup.md](../mobile-oauth-redirect-setup.md)

**Automated pre-flight (run before manual QA):**

```bash
npm test -- shared/
cd mobile && npx tsc --noEmit
```

---

## Pre-test setup

- [ ] iOS device/simulator (iOS 14+)
- [ ] Android device/emulator (Android 6+)
- [ ] Test accounts for at least 5 OAuth marketplaces (e.g. Etsy, eBay, Shopify, Amazon, Shopee) with saved credentials in Safari (iOS) and Chrome (Android)
- [ ] Test accounts with **no** saved credentials (fallback login)
- [ ] Server `.env` with client IDs for test marketplaces (or mocked `/api/marketplaces/oauth-config`)
- [ ] Mobile build with `EXPO_PUBLIC_*` secrets for test marketplaces (`mobile/.env.example`)
- [ ] Redirect URI `kauf26://oauth/{marketplace_id}` registered in each marketplace developer dashboard

---

## Core one-tap flow (OAuth marketplaces)

### Test 1: Saved credentials in browser — one tap, no typing

| Marketplace | Steps | Expected |
|-------------|-------|----------|
| Etsy | Tap **Connect Etsy — one tap** → browser opens | “Continue as [username]” or one-tap authorize → returns to app → name/email auto-filled |
| eBay | Same | One tap → token on device → profile auto-filled |
| Shopify | Same (enter store domain first) | One tap → works |
| Amazon | Same | One tap → works |
| Shopee | Same | One tap → works |
| Other (e.g. Allegro, MercadoLibre) | Same | Success |

- [ ] Pass / Fail: ___________

### Test 2: No saved credentials — normal OAuth login

- [ ] Clear browser cookies/passwords for one marketplace
- [ ] Tap **Connect** → full login form in system browser
- [ ] Enter credentials manually → authorize → returns to app
- [ ] Token stored on device; profile auto-filled
- [ ] **Verify:** no password/token sent to Kauf26 server (check server logs — no `/oauth/token` on backend)

- [ ] Pass / Fail: ___________

### Test 3: User cancels OAuth

- [ ] Tap **Connect** → tap Cancel/Close in browser
- [ ] App shows **“Connection cancelled”** banner (not a crash)
- [ ] No partial token stored
- [ ] User can tap Connect again

- [ ] Pass / Fail: ___________

### Test 4: App closed mid-OAuth

- [ ] Tap **Connect** → force-close app while browser open
- [ ] Reopen app → no crash
- [ ] Marketplace shows not connected (or completes if redirect received on cold start)
- [ ] Tap Connect again → flow works

- [ ] Pass / Fail: ___________

---

## Background / resume handling

### Test 5: App backgrounded during OAuth (iOS & Android)

- [ ] Tap **Connect** → press Home → return to app
- [ ] OAuth completes, browser reappears, or friendly error + retry
- [ ] iOS: ASWebAuthenticationSession not falsely reported as cancelled

- [ ] Pass / Fail: ___________

### Test 6: Multi-tasking during OAuth

- [ ] Start OAuth → switch to another app → switch back
- [ ] Browser still visible or app receives token — no crash

- [ ] Pass / Fail: ___________

---

## Redirect URI handling

### Test 7: Custom scheme `kauf26://oauth/{id}`

- [ ] iOS: `CFBundleURLSchemes` includes `kauf26` (`mobile/app.json`)
- [ ] Android: intent-filter with `kauf26` + host `oauth`
- [ ] App opens with `kauf26://oauth/etsy?code=...` and exchanges token

- [ ] Pass / Fail: ___________

### Test 8: Incorrect redirect URI

- [ ] Wrong redirect in server `.env`
- [ ] Error: **“Redirect URI mismatch – check developer portal”**
- [ ] No token stored

- [ ] Pass / Fail: ___________

---

## Non-OAuth marketplaces (10)

### Test 9: Partnership / API-key UI

Depop, Fruugo, Magento, Newegg, Poshmark, Rakuten, StockX, TikTok Shop, Vinted, WooCommerce

- [ ] Informational card only — no Connect button
- [ ] No crash

- [ ] Pass / Fail: ___________

---

## Token storage & security

### Test 10: Device-only tokens

- [ ] No user tokens on server
- [ ] SecureStore on device; gone after uninstall

- [ ] Pass / Fail: ___________

### Test 11: Etsy token refresh

- [ ] Refresh or re-auth on expiry — no crash

- [ ] Pass / Fail: ___________

---

## UI & messaging

### Test 12: All 26 marketplaces on Connections screen

- [ ] 26 cards (16 OAuth + 10 non-OAuth)
- [ ] Configured → Connect button; unconfigured → gray message

- [ ] Pass / Fail: ___________

### Test 13: Profile auto-fill

- [ ] Name/email editable; missing email OK

- [ ] Pass / Fail: ___________

---

## Error handling

### Test 14: Network failure

- [ ] Airplane mode → **“Network error, please try again”**

- [ ] Pass / Fail: ___________

### Test 15: Invalid scope

- [ ] Descriptive error; user can retry

- [ ] Pass / Fail: ___________

---

## Regression

- [ ] Etsy, eBay, Shopify one-tap unchanged
- [ ] Web onboarding: mobile-only, no marketplace passwords
- [ ] Web Settings: mobile connect guidance

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
