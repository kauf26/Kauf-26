# Phase 2 — App Store & Google Play Submission Prep

Complete after Phase 1 (`docs/PHASE1_APP_STORE_PREP.md`). Target: TestFlight + Play internal testing.

---

## Status snapshot

| Item | Status | Notes |
|------|--------|-------|
| Production URLs (`.env`, `mobile/.env`) | ✅ Set | `api.kaufai.com`, `kaufai.com` |
| `APPLE_CLIENT_ID` | ✅ Set | `com.kaufai.app` |
| Apple Team ID / Key / `.p8` | ⏳ You | See §1 below |
| Google OAuth | ⏳ You | Placeholders in `.env` |
| Privacy policy | ✅ Live | https://kaufai.com/privacy (+ COPPA) |
| Terms of Service | ✅ Created | https://kaufai.com/terms |
| Support URL | ✅ Created | https://kaufai.com/support |
| Info.plist strings | ✅ Done | `mobile/app.json` |
| API deployed | ❌ Blocker | `api.kaufai.com` SSL not serving API yet |
| App Store assets | ⏳ You | See §6 |

---

## 1. Apple Sign-In (CRITICAL)

### A. Create App ID
1. [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. **+** → **App IDs** → **App**
3. Description: `Kauf26`
4. Bundle ID: **Explicit** → `com.kaufai.app`
5. Capabilities: enable **Sign in with Apple** → Configure → **Enable as primary App ID**
6. Register

### B. Team ID
[Membership](https://developer.apple.com/account#MembershipDetailsCard) → copy **Team ID** (10 characters)

### C. Auth Key (.p8) — for web Apple OAuth (optional for native-only)
1. [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+**
2. Name: `Kauf26 Sign In with Apple`
3. Enable **Sign in with Apple** → Configure → select your App ID
4. **Download `.p8`** (once only) → store securely
5. Note **Key ID**

### D. App Store Connect app
1. [App Store Connect](https://appstoreconnect.apple.com/) → **My Apps** → **+** → New App
2. Platform: iOS
3. Name: **Kauf26**
4. Bundle ID: `com.kaufai.app`
5. SKU: `kauf26-ios`

### E. Server `.env`
```bash
# Required for native iOS (already set locally)
APPLE_CLIENT_ID=com.kaufai.app

# Optional — web Apple OAuth only
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

### F. EAS submit (`mobile/eas.json` — local only)
```json
"appleTeamId": "YOUR_TEAM_ID"
```

### G. Test native Sign in with Apple
**Requires API running with `APPLE_CLIENT_ID` set.**

```bash
# Server must return 401 (not 503) for bad token:
curl -s -X POST https://api.kaufai.com/api/auth/mobile/apple \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"invalid"}'
```

On device: Login → **Sign in with Apple** → account created, Settings loads.

---

## 2. Google Sign-In

### A. Google Cloud Console
1. [console.cloud.google.com](https://console.cloud.google.com/) → project **Kauf26**
2. **APIs & Services** → **OAuth consent screen**
   - User type: **External**
   - App name: `KaufAI`
   - Support email: `support@kaufai.com`
   - App domain: `kaufai.com`
   - Privacy: `https://kaufai.com/privacy`
   - Terms: `https://kaufai.com/terms`
3. **Credentials** → **Create credentials** → **OAuth client ID**
4. Type: **Web application**
5. **Authorized redirect URIs:**
   ```
   https://api.kaufai.com/api/auth/google/callback
   ```
6. Copy Client ID + Secret → server `.env`:
   ```bash
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
   ```

### B. iOS URL scheme (already configured)
Mobile uses `kauf26://auth/google` — Google redirects via system browser back to app.

### C. Test
Login → **Continue with Google** → returns to app with session.

---

## 3. Production URLs

Already configured:

| File | Variables |
|------|-----------|
| `.env` | `APP_BASE_URL`, `CLIENT_URL`, `VITE_API_URL` |
| `mobile/.env` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_BASE_URL` |

**Production server** must use the same values (not localhost `DATABASE_URL`).

**Verify:**
```bash
cd mobile && npm run validate:production-env -- --production
curl -sI https://kaufai.com/privacy | head -1
curl -s https://api.kaufai.com/api/health   # must work before store submit
```

---

## 4. Privacy policy

**URL:** https://kaufai.com/privacy

Includes:
- Data collection categories
- Usage & third parties (OpenAI, Stripe, marketplaces)
- User rights (access, delete, export, revoke)
- In-app deletion: **Settings → Delete account**
- **Children's privacy (COPPA)** — section 7

**App Store Connect:** Privacy Nutrition Labels must match this policy.

---

## 5. Terms of Service

**URL:** https://kaufai.com/terms

Includes: eligibility, accounts, marketplace connections, prohibited uses, IP, AI disclaimers, payments, liability limits, termination.

Mobile resolves: `EXPO_PUBLIC_WEB_BASE_URL` + `/terms`

---

## 6. App Store assets

### App icon
- Source: `mobile/assets/icon.png` (must be **1024×1024** for App Store Connect)
- EAS/Expo generates all iOS sizes from this file

```bash
# Check icon dimensions:
sips -g pixelWidth -g pixelHeight mobile/assets/icon.png
```

If not 1024×1024, export a square 1024 PNG from your logo.

### Screenshots (required sizes)
| Device | Size (portrait) | App Store Connect slot |
|--------|-----------------|------------------------|
| 6.5" display | 1284 × 2778 | iPhone 14 Pro Max / 15 Plus |
| 5.5" display | 1242 × 2208 | iPhone 8 Plus |

Capture from Simulator:
```bash
cd mobile && npx expo run:ios
# Simulator → Device → iPhone 15 Pro Max → Cmd+S for screenshot
```

Suggested screens: Login, Camera/Identify, Draft listing, Connections, Settings.

### Copy (draft in `STORE_LISTING_IOS.md`)
- **Subtitle:** `AI listings for Etsy, eBay, Shopify`
- **Keywords:** `etsy,ebay,shopify,reseller,listing,inventory,marketplace,sell`
- **Support URL:** https://kaufai.com/support
- **Privacy URL:** https://kaufai.com/privacy
- **Marketing URL:** https://kaufai.com

### App Preview (optional)
15–30 sec screen recording in Simulator → upload to App Store Connect.

---

## 7. Info.plist (iOS permissions)

Configured in **`mobile/app.json`** → `ios.infoPlist`:

| Key | Value |
|-----|-------|
| `NSCameraUsageDescription` | To take photos of products to list on marketplaces |
| `NSPhotoLibraryUsageDescription` | To select product images for your listings |
| `NSLocalNetworkUsageDescription` | To connect to marketplace APIs |

**Apply to native project:**
```bash
cd mobile
npx expo prebuild --clean -p ios
grep -E "NSCamera|NSPhotoLibrary|NSLocalNetwork" ios/Kauf26/Info.plist
```

---

## Build & submit checklist

```bash
# 1. Readiness
node scripts/verify-store-readiness.js

# 2. iOS prebuild
cd mobile && npx expo prebuild --clean -p ios

# 3. EAS production build
eas login
eas build --platform ios --profile production
eas build --platform android --profile production

# 4. Submit
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## Your next 3 actions (today)

1. **Apple Developer:** Create App ID + enable Sign in with Apple → paste `APPLE_TEAM_ID` into `.env`
2. **Google Cloud:** Create OAuth client → paste `GOOGLE_CLIENT_ID` / `SECRET`
3. **Deploy API** to `api.kaufai.com` (see `DEPLOY_BACKEND.md`) — **required before TestFlight testing**
