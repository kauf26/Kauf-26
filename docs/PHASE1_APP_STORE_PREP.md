# Phase 1 — App Store / Play Store Submission Prep

Target: submission-ready within 48 hours. Work through items **in order**.

---

## 1. Fix critical security issue — Stripe key rotation

### Why
A **live** Stripe secret (`sk_live_…`) was in local `.env`. Live keys must only exist on the **production server**, never on a dev machine or in git.

### Steps (do this first)

1. **Stripe Dashboard** → [Developers → API keys](https://dashboard.stripe.com/apikeys)
2. **Roll the live secret key** (or delete the exposed key and create a new one)
   - Note the new `sk_live_…` — store in your password manager only
3. **Copy the test secret key** (`sk_test_…`) for local development
4. Update **local** `.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_TEST_WEBHOOK_SECRET
   ```
5. On **production server** `.env` only:
   ```bash
   STRIPE_SECRET_KEY=sk_live_NEW_ROTATED_KEY
   STRIPE_WEBHOOK_SECRET=whsec_PRODUCTION_WEBHOOK
   ```
6. **Stripe Dashboard** → Webhooks → create/update endpoint `https://api.kaufai.com/api/webhooks/stripe` with production secret
7. Verify `.env` is in `.gitignore` and was never committed:
   ```bash
   git log --all -- .env
   ```

### Files
| File | Action |
|------|--------|
| `.env` (local) | `sk_test_…` only |
| Production host `.env` | `sk_live_…` (new rotated key) |
| `.env.example` | Placeholders only (already safe) |

### Verify
```bash
# Local — should NOT start with sk_live_
grep STRIPE_SECRET_KEY .env

# Hit a test endpoint or run billing flow in test mode
```

---

## 2. Apple Sign-In keys (submission blocker)

Native iOS uses **Sign in with Apple** via `expo-apple-authentication`. The server verifies the identity token with **`APPLE_CLIENT_ID` = your bundle ID**.

### Step-by-step — Apple Developer

#### A. Confirm App ID
1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Find or create **App ID**: `com.globalmarketplacelister.app`
3. Enable capability: **Sign in with Apple** → Configure → **Enable as primary App ID**
4. Save

#### B. Team ID
1. [Membership details](https://developer.apple.com/account#MembershipDetailsCard) → copy **Team ID** (10 characters, e.g. `AB12CD34EF`)

#### C. Key for web OAuth (optional but recommended if Google web OAuth is used)
> Native mobile only needs `APPLE_CLIENT_ID`. Web Apple OAuth (`passport-apple`) needs the `.p8` key.

1. [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+** Create a key
2. Name: `Kauf26 Sign In with Apple`
3. Enable **Sign in with Apple** → Configure → select App ID `com.globalmarketplacelister.app`
4. Register → **Download `.p8` file** (only downloadable once — store securely)
5. Note **Key ID** (e.g. `XYZ123ABCD`)

#### D. Services ID (web only — skip for native-only launch)
Only needed for web Sign in with Apple at `https://api.kaufai.com/api/auth/apple/callback`.

#### E. Add to server `.env`
```bash
# Required for native iOS Sign in with Apple
APPLE_CLIENT_ID=com.globalmarketplacelister.app

# Required for web Apple OAuth (optional for native-only)
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----
```
Paste `.p8` contents as one line with `\n` for newlines, or use a multiline env on the server.

### Files
| File | Purpose |
|------|---------|
| `.env` | `APPLE_*` vars on API server |
| `mobile/app.json` | `"usesAppleSignIn": true` (already set) |
| `mobile/eas.json` | `appleTeamId` in submit profile |

### Verify
```bash
# Server running with APPLE_CLIENT_ID set
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:2626/api/auth/mobile/apple \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"invalid"}'
# Expect 401 (not 503 "not configured")
```

On device: Login screen → **Sign in with Apple** → completes without "not configured" error.

---

## 3. Production URLs

### Files to modify

| File | Variables |
|------|-----------|
| `.env` (API server) | `APP_BASE_URL`, `CLIENT_URL`, `VITE_API_URL` |
| `mobile/.env` (EAS / production builds) | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_BASE_URL` |
| Production server host | Same as `.env` on `api.kaufai.com` |

### Values
```bash
# Server .env
APP_BASE_URL=https://api.kaufai.com
CLIENT_URL=https://kaufai.com
VITE_API_URL=https://api.kaufai.com

# mobile/.env (production builds)
EXPO_PUBLIC_API_URL=https://api.kaufai.com
EXPO_PUBLIC_WEB_BASE_URL=https://kaufai.com
```

### Local dev
Keep a **commented** localhost block in each file, or copy `mobile/.env.example` and use LAN IP for physical device testing.

### Verify
```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.kaufai.com \
EXPO_PUBLIC_WEB_BASE_URL=https://kaufai.com \
npm run validate:production-env

curl -sI https://api.kaufai.com/health | head -1
curl -sI https://kaufai.com/privacy | head -1
```

---

## 4. Google Sign-In keys

### Steps
1. [Google Cloud Console](https://console.cloud.google.com/) → select/create project **Kauf26**
2. **APIs & Services** → **OAuth consent screen** → External → fill app name, support email, `kaufai.com` domains
3. **Credentials** → **Create credentials** → **OAuth 2.0 Client ID**
4. Type: **Web application**
5. **Authorized redirect URIs**:
   ```
   https://api.kaufai.com/api/auth/google/callback
   ```
6. For mobile browser flow, also add (if prompted):
   ```
   kauf26://auth/google
   ```
7. Copy **Client ID** and **Client secret** → server `.env`:
   ```bash
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
   ```

### Verify
Open on device: Login → **Continue with Google** → redirects back to app without "not configured".

---

## 5. eBay production switch

### Steps
1. [eBay Developer Keys](https://developer.ebay.com/my/keys) → **Production** keys (not Sandbox)
2. Update `.env`:
   ```bash
   EBAY_CLIENT_ID=your_production_app_id
   EBAY_CLIENT_SECRET=your_production_cert_id
   EBAY_APP_ID=your_production_app_id
   EBAY_CERT_ID=your_production_cert_id
   EBAY_SANDBOX=false
   ```
3. **Business policies** (Seller Hub → Account → Business policies):
   - Fulfillment → copy ID → `EBAY_FULFILLMENT_POLICY_ID`
   - Payment → `EBAY_PAYMENT_POLICY_ID`
   - Return → `EBAY_RETURN_POLICY_ID`
4. **Redirect URIs** in eBay developer portal:
   - `kauf26://oauth/ebay`
   - `https://api.kaufai.com/api/auth/callback`
5. RuName / `EBAY_REDIRECT_URI` must match production registration

### Verify
Connect eBay from mobile → OAuth completes → listing publish test in sandbox-off mode.

---

## 6. Privacy policy (Apple / Google)

### URL
- **Live:** https://kaufai.com/privacy (`public/privacy.html` via Vercel `cleanUrls`)
- Mobile resolves: `EXPO_PUBLIC_WEB_BASE_URL` + `/privacy`

### Required disclosures (added in `public/privacy.html`)
- Data collection categories (account, photos, marketplace tokens, device)
- How data is used (AI identify, sync, auth)
- User rights (access, delete, export)
- Third-party sharing (OpenAI, Stripe, marketplaces)
- **In-app account deletion** (Settings → Delete account)

### Verify
```bash
curl -sI https://kaufai.com/privacy | head -1   # HTTP/2 200
node scripts/verify-store-readiness.js --skip-tests
```

---

## 7. iOS Info.plist permission strings

Expo manages Info.plist via **`mobile/app.json`** → `ios.infoPlist` (regenerated on `expo prebuild`).

After editing `app.json`:
```bash
cd mobile
npx expo prebuild --clean -p ios
```

### Verify
```bash
grep -E "NSCamera|NSPhotoLibrary|NSLocalNetwork" mobile/ios/Kauf26/Info.plist
```

---

## 48-hour checklist

| Day | Tasks |
|-----|-------|
| **Hour 0–4** | Stripe rotation, production URLs, `app.json` permissions, privacy policy deploy |
| **Hour 4–12** | Apple App ID + `APPLE_CLIENT_ID`, Google OAuth, deploy API to `api.kaufai.com` |
| **Hour 12–24** | EAS production build, TestFlight internal test, Apple + Google login on device |
| **Hour 24–48** | eBay production keys, Etsy secret, `verify-store-readiness.js`, store listing copy |

```bash
node scripts/verify-store-readiness.js
cd mobile && npm run validate:production-env
```
