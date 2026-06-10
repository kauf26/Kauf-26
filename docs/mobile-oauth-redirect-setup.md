# Mobile OAuth — Redirect URI setup

One-tap marketplace connect uses custom-scheme deep links. The redirect URI sent in every OAuth request **must match exactly** what you register in each marketplace developer console and in server `.env`.

Canonical URIs (defined in `shared/oauthRedirect.ts`):

| Marketplace | Redirect URI |
|-------------|--------------|
| Etsy | `kauf26://oauth/etsy` |
| Shopify | `kauf26://oauth/shopify` |
| eBay | `kauf26://oauth/ebay` |

Server env (defaults match the table above):

```env
ETSY_REDIRECT_URI=kauf26://oauth/etsy
SHOPIFY_OAUTH_REDIRECT_URI=kauf26://oauth/shopify
EBAY_REDIRECT_URI=kauf26://oauth/ebay
```

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

Run automated URI checks:

```bash
npm test -- shared/oauthRedirect.test.ts
```

Mobile TypeScript check:

```bash
cd mobile && npx tsc --noEmit
```

---

## Architecture reminder

- **No server token storage** — OAuth tokens live in Expo SecureStore on the device only.
- **No embedded WebView** — ASWebAuthenticationSession (iOS) and Chrome Custom Tabs (Android) only.
- **No marketplace passwords** collected by Kauf26 — users sign in via the system browser.
