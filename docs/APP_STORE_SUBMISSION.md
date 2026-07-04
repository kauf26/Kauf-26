# App Store Submission Guide — Kauf26 (iOS)

Bundle ID: `com.kaufai.app`  
API (current): https://kauf-26.onrender.com  
API (production target): https://api.kaufai.com  
Privacy URL: https://kauf-26.onrender.com/api/privacy → `/privacy`  
Terms URL: https://kauf-26.onrender.com/api/terms → `/terms`

---

## 1. App Store Connect configuration

### Bundle ID (already correct)

| Field | Value |
|---|---|
| Bundle ID | `com.kaufai.app` |
| App name (display) | Kauf26 |
| SKU | `kauf26-ios` |
| Apple Team ID | `U2M253533S` |

**Create in [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list):**

1. App IDs → **+** → App → Explicit ID `com.kaufai.app`
2. Enable **Sign in with Apple** (primary App ID)
3. Register

**Create app in [App Store Connect](https://appstoreconnect.apple.com/):**

1. My Apps → **+** → New App → iOS
2. Name: **Kauf26**
3. Bundle ID: `com.kaufai.app`
4. Copy **Apple ID** (numeric) → set `ascAppId` in `mobile/eas.json`

### Privacy Manifest (iOS 17+)

| File | Purpose |
|---|---|
| `mobile/PrivacyInfo.xcprivacy` | Human-readable reference (source of truth) |
| `mobile/plugins/withPrivacyManifest.js` | Expo config plugin — writes manifest into iOS target at `eas build` |

**Declared in manifest:**

- **Tracking:** No (`NSPrivacyTracking: false`)
- **Collected data:** Email, Name, Photos/Videos, User ID, Product Interaction
- **Required Reason APIs:** UserDefaults (`CA92.1`), File Timestamp (`C617.1`)

Rebuild iOS after any manifest change:

```bash
cd mobile
eas build --platform ios --profile production
```

---

## 2. App Privacy questionnaire (App Store Connect)

Answer **App Privacy** in App Store Connect → your app → **App Privacy**. Use these answers:

### Data collection summary

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info → Email** | Yes | Yes | No | App functionality (account, sign-in) |
| **Contact Info → Name** | Yes | Yes | No | App functionality (profile display) |
| **User Content → Photos** | Yes | No | No | App functionality (product identify / listings) |
| **Identifiers → User ID** | Yes | Yes | No | App functionality (account) |
| **Usage Data → Product interaction** | Yes | Yes | No | App functionality (trial status, feature usage) |
| **Financial Info → Payment info** | No* | — | — | *Stripe handles payments; app does not store card data |
| **Location** | No | — | — | — |
| **Browsing history** | No | — | — | — |

### Third-party data sharing (disclose in questionnaire)

| Partner | Data shared | Purpose |
|---|---|---|
| **OpenAI** | Product photos (for AI identify) | Generate listing title/description |
| **Stripe** | Payment metadata only (no card numbers stored by app) | Service fee processing |
| **Google** | OAuth profile (if user signs in with Google) | Authentication |
| **Apple** | Sign in with Apple token | Authentication |
| **Marketplaces** (eBay, Etsy, Shopify, etc.) | Listing data + OAuth tokens (device-only storage for tokens) | Publish listings on user-connected stores |

### Privacy practices

- **Data used to track you:** No
- **Data linked to you:** Email, Name, User ID, Product interaction
- **Data not linked to you:** Photos (processed for identify; not used for cross-app tracking)

---

## 3. App metadata & assets

### App Store description (optimized)

**Subtitle (30 chars max):**  
`AI Listings for Marketplaces`

**Description:**

```
Kauf26 helps sellers create product listings for multiple online marketplaces from a single photo.

Snap or upload a product image and Kauf26 uses AI to identify the item, suggest a title, description, and price, then prepare drafts you can publish to connected stores including eBay, Etsy, and Shopify.

KEY FEATURES
• AI product identification from photos (up to 5 angles)
• Multi-marketplace listing drafts in one workflow
• Connect Etsy, eBay, Shopify, and more via secure OAuth
• Sign in with Apple and Google
• Sales tracking and shipping label tools
• Face ID app lock for quick, secure access

WHO IT'S FOR
Resellers, thrift sellers, and small businesses who list on more than one marketplace and want to save time on repetitive listing work.

IMPORTANT
Kauf26 is a listing assistant — not a marketplace. All sales happen on the third-party platforms you connect. You are responsible for reviewing AI-generated titles and descriptions before publishing.

Privacy Policy: https://kauf-26.onrender.com/api/privacy
Terms of Service: https://kauf-26.onrender.com/api/terms
Support: kaufit@yahoo.com
```

### What's New (version 1.0.0)

```
Welcome to Kauf26 1.0!

• AI-powered product identification from photos
• Create listing drafts for eBay, Etsy, Shopify, and more
• Sign in with Apple and Google
• Connect marketplaces with secure OAuth
• Track sales and manage inventory
• Face ID quick unlock

We're excited to help you list faster across marketplaces. Questions? Contact kaufit@yahoo.com
```

### Keywords (100 chars max, comma-separated)

```
marketplace,ebay,etsy,shopify,reseller,listing,AI,thrift,sell,inventory,ecommerce,product,photo
```

### Screenshot specifications

| Device | Size (pixels) | Required |
|---|---|---|
| iPhone 6.7" (15 Pro Max, 14 Pro Max) | 1290 × 2796 | **Yes** — primary |
| iPhone 6.5" (11 Pro Max, XS Max) | 1242 × 2688 | **Yes** |
| iPhone 5.5" (8 Plus) | 1242 × 2208 | Optional (legacy) |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 | **Yes** (app supports iPad) |

**Suggested screens to capture:** Login → Camera/Identify → Draft review → Marketplace connections → Listings dashboard

---

## 4. Technical requirements — verification

| Item | Status | Value / notes |
|---|---|---|
| `bundleIdentifier` | ✅ | `com.kaufai.app` |
| `CFBundleShortVersionString` | ✅ | `1.0.0` (`expo.version`) |
| `CFBundleVersion` | ✅ Fixed | `1` (`ios.buildNumber`) — was `1.0.0`, now integer |
| `LSApplicationCategoryType` | ✅ Added | `public.app-category.business` |
| `NSCameraUsageDescription` | ✅ | Product photos for listings |
| `NSPhotoLibraryUsageDescription` | ✅ | Select photos from library |
| `NSFaceIDUsageDescription` | ✅ | Face ID app lock |
| `usesAppleSignIn` | ✅ | `true` |
| `supportsTablet` | ✅ | `true` (iPhone + iPad) |
| OAuth URL schemes | ✅ | `kauf26://oauth/*`, `kauf26://auth/*` |
| `usesNonExemptEncryption` | ✅ | `false` (export compliance) |
| `expo-camera` plugin | ✅ | Camera permission string set |
| `expo-image-picker` plugin | ✅ | Registered |
| Production API URL | ⚠️ | `eas.json` → `https://api.kaufai.com` (needs DNS) |

---

## 5. Legal & compliance

| URL | Route | Status |
|---|---|---|
| Privacy Policy | `/privacy`, `/api/privacy` (redirect) | ✅ Live on Render SPA |
| Terms of Service | `/terms`, `/api/terms` (redirect) | ✅ Live on Render SPA |
| Support | `kaufit@yahoo.com` | Use in App Store Connect |

### Third-party SDKs (mobile)

| SDK | Data accessed | Privacy manifest |
|---|---|---|
| expo-apple-authentication | Apple ID token, email (optional) | Bundled by Expo |
| expo-camera | Camera | Permission string in Info.plist |
| expo-image-picker | Photo library | Permission string |
| expo-secure-store | OAuth tokens (device Keychain) | No server persistence |
| expo-local-authentication | Face ID / Touch ID | Local only |
| expo-web-browser | OAuth browser sessions | No tracking |
| react-native-webview | Marketplace OAuth flows | User-initiated |
| axios | API calls to your server | HTTPS only |

Server-side third parties: OpenAI (images), Stripe (payments), marketplace APIs (OAuth).

---

## 6. Demo account for Apple Review

### Option A — Sign in with Apple (recommended, no setup)

Reviewer uses **Sign in with Apple** on the Login screen. No demo credentials required.

### Option B — App Review demo login (optional, env-gated)

Enable **only during Apple review**, then disable after approval.

**Render environment variables:**

```env
APP_REVIEW_DEMO_ENABLED=true
APP_REVIEW_DEMO_EMAIL=demo@example.com
APP_REVIEW_DEMO_PASSWORD=Demo123!
```

When enabled, the mobile Login screen shows an **App Review login** section. The server logs a warning at startup. Set `APP_REVIEW_DEMO_ENABLED=false` (or remove the vars) after approval.

**Security:** Credentials are never hardcoded — only read from server env. Endpoint returns 404 when disabled.

### App Review Notes (paste into App Store Connect)

```
Kauf26 is a multi-marketplace listing assistant for resellers.

SIGN IN
• Preferred: "Sign in with Apple"
• If App Review demo is enabled on our server: use the "App Review login" section with credentials provided in App Review Information below.
• Marketplace connections (Etsy, eBay, Shopify) are OPTIONAL for testing core features.

CORE FLOW WITHOUT MARKETPLACE ACCOUNTS
1. Sign in with Apple
2. Tap Identify / camera icon on Home
3. Take or upload a product photo
4. Tap Identify — AI generates a listing draft
5. Review draft on Product Draft screen

MARKETPLACE CONNECTIONS (optional)
Settings → Connections → connect Etsy/eBay/Shopify via OAuth in system browser.
OAuth returns via kauf26:// scheme.

API
Production API: https://api.kaufai.com (or https://kauf-26.onrender.com during review if custom domain pending).

PRIVACY
https://kauf-26.onrender.com/api/privacy

No special hardware required. Camera permission needed for photo capture; gallery upload works as fallback.
```

---

## 7. Mobile iOS specifics

| Check | Status |
|---|---|
| `EXPO_PUBLIC_API_URL` production | `https://api.kaufai.com` in `eas.json` |
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://kaufai.com` |
| OAuth redirect scheme | `kauf26://oauth/{provider}` |
| Marketplace tokens | Device SecureStore only |
| Account deletion | Settings → Delete account |
| `ascAppId` in eas.json | ⚠️ Still `YOUR_APP_STORE_CONNECT_APP_ID` — update after creating app |

### Test marketplace OAuth on iOS

1. Production build: `cd mobile && eas build --platform ios --profile production`
2. Install via TestFlight
3. Settings → Connections → Etsy (or Shopify)
4. Complete OAuth in Safari → returns to app via `kauf26://oauth/etsy`
5. Requires marketplace keys on server + `api.kaufai.com` DNS

---

## 8. Pre-submission checklist

### Infrastructure
- [x] API live — `curl https://kauf-26.onrender.com/api/health` → `{"status":"ok"}`
- [x] `OPENAI_API_KEY` set on Render
- [x] `DATABASE_URL` Neon connection string
- [x] `SESSION_SECRET` + `SESSION_ENCRYPTION_KEY` set
- [x] `APPLE_CLIENT_ID=com.kaufai.app`
- [ ] DNS: `api.kaufai.com` → Render (for production mobile builds)
- [ ] Run `bash render-selfcheck.sh`

### iOS build
- [x] `PrivacyInfo.xcprivacy` + plugin updated
- [x] `buildNumber` = `1`
- [x] `LSApplicationCategoryType` set
- [ ] Update `ascAppId` in `mobile/eas.json`
- [ ] `eas build --platform ios --profile production`
- [ ] Upload to TestFlight
- [ ] Test Sign in with Apple on device
- [ ] Test camera + identify flow
- [ ] Test gallery upload fallback

### App Store Connect
- [ ] Create app record
- [ ] Complete App Privacy questionnaire (§2 above)
- [ ] Upload screenshots (6.7", 6.5", iPad Pro)
- [ ] Paste description, keywords, What's New
- [ ] Privacy Policy URL: `https://kauf-26.onrender.com/api/privacy`
- [ ] Support URL / email
- [ ] Age rating questionnaire
- [ ] Export compliance: No encryption beyond HTTPS (`usesNonExemptEncryption: false`)
- [ ] Paste App Review Notes (§6)
- [ ] Submit for review

### Verification commands

```bash
# API health + OAuth
bash render-selfcheck.sh

# Production build
npm run build

# iOS production build
cd mobile && eas build --platform ios --profile production

# Submit to App Store (after TestFlight QA)
cd mobile && eas submit --platform ios --profile production
```

---

## 9. Step-by-step App Store Connect submission

1. **Create app** in App Store Connect (Bundle ID `com.kaufai.app`)
2. **Copy Apple ID** → update `mobile/eas.json` → `ascAppId`
3. **Run** `eas build --platform ios --profile production`
4. **Wait** for build → auto-upload to TestFlight (or `eas submit`)
5. **TestFlight** — install on iPhone, run full test plan
6. **App Information** — category: Business, privacy URL, support email
7. **App Privacy** — complete questionnaire using §2
8. **Pricing** — free or paid
9. **Prepare for Submission** — version 1.0.0, build `1`, screenshots, description
10. **App Review Information** — paste notes from §6
11. **Submit for Review**

---

## Summary of fixes completed for submission

| Area | Status |
|---|---|
| Environment variables (Render) | DATABASE_URL, sessions, OPENAI, APPLE_CLIENT_ID configured |
| Camera component (web) | Fixed video stream binding (`d51e4e453`) |
| Deployment | Live at kauf-26.onrender.com, health OK |
| Privacy manifest | Enhanced for iOS 17+ (`PrivacyInfo.xcprivacy` + plugin) |
| Legal URLs | `/api/privacy` and `/api/terms` redirects added |
| Build metadata | `buildNumber: 1`, `LSApplicationCategoryType` set |
