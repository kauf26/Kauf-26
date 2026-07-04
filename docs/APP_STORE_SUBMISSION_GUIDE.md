# Kauf26 — App Store Submission Guide

Complete step-by-step guide for submitting **Kauf26: AI Marketplace Lister** to the Apple App Store.

| Field | Value |
|-------|-------|
| Bundle ID | `com.kaufai.app` |
| Version | 1.0.0 (Build 1) |
| API (production) | https://kauf-26.onrender.com |
| Apple Team ID | `U2M253533S` |
| EAS Project ID | `59f74669-28ab-41fc-8f7b-18fc9b0a5595` |

---

## Pre-Submission Checklist

Mark each item before submitting.

### Code & Configuration

- [x] `mobile/PrivacyInfo.xcprivacy` — iOS 17+ privacy manifest (no tracking, data types, API reasons)
- [x] `mobile/plugins/withPrivacyManifest.js` — injects manifest at EAS build
- [x] `mobile/app.json` — bundle ID, version 1.0.0, build 1, Info.plist permissions, `supportsTablet: true`, portrait
- [x] `mobile/eas.json` — production profile with Render API URLs and legal page URLs
- [x] `server/legal/htmlPages.ts` — standalone HTML privacy & terms
- [x] `server/index.ts` — `/api/privacy` and `/api/terms` HTML endpoints
- [x] `shared/demoAccount.ts` — dev-only demo account (disabled in production)
- [x] `docs/APP_STORE_METADATA.md` — App Store copy-paste metadata
- [x] `docs/APP_PRIVACY_ANSWERS.md` — Privacy questionnaire answers
- [x] Sign in with Apple enabled (`usesAppleSignIn: true`)
- [x] `usesNonExemptEncryption: false` (standard HTTPS only)
- [ ] Replace `YOUR_APP_STORE_CONNECT_APP_ID` in `mobile/eas.json` after creating the app in App Store Connect

### Server (Render Production)

- [x] API health: `curl https://kauf-26.onrender.com/api/health`
- [x] Privacy policy live: https://kauf-26.onrender.com/api/privacy
- [x] Terms live: https://kauf-26.onrender.com/api/terms
- [ ] `OPENAI_API_KEY` set on Render (required at boot)
- [ ] `SESSION_SECRET` and `SESSION_ENCRYPTION_KEY` set on Render
- [ ] `APPLE_CLIENT_ID=com.kaufai.app` on Render
- [ ] `APP_BASE_URL` and `CLIENT_URL` point to production URL

### App Store Connect

- [ ] App record created with bundle ID `com.kaufai.app`
- [ ] App Privacy questionnaire completed (see `APP_PRIVACY_ANSWERS.md`)
- [ ] Screenshots uploaded (6.7", 6.5", iPad 12.9")
- [ ] Metadata pasted from `APP_STORE_METADATA.md`
- [ ] Age rating questionnaire completed (4+)
- [ ] Export compliance: No custom encryption (already declared in app.json)

### Build & Test

- [ ] `npm run build` passes
- [ ] `bash render-selfcheck.sh` passes
- [ ] EAS production iOS build succeeds
- [ ] TestFlight internal testing completed
- [ ] Sign in with Apple tested on physical device
- [ ] Camera + photo library permissions tested
- [ ] AI identify flow tested end-to-end

---

## Step 1: Commit & Deploy Server Changes

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local

git status
git add \
  mobile/PrivacyInfo.xcprivacy \
  mobile/app.json \
  mobile/eas.json \
  mobile/plugins/withPrivacyManifest.js \
  mobile/src/services/demoAuth.ts \
  mobile/src/screens/LoginScreen.tsx \
  server/legal/htmlPages.ts \
  server/index.ts \
  server/auth/demoLogin.ts \
  server/auth/routes.ts \
  shared/demoAccount.ts \
  docs/APP_STORE_METADATA.md \
  docs/APP_PRIVACY_ANSWERS.md \
  docs/APP_STORE_SUBMISSION_GUIDE.md

git commit -m "$(cat <<'EOF'
Complete iOS App Store submission prep for Kauf26 1.0.0.

Add privacy manifest, legal HTML endpoints, dev-only demo account,
App Store metadata docs, and production EAS configuration.
EOF
)"

git push origin main
```

Wait for Render auto-deploy (~2–5 min), then verify:

```bash
bash render-selfcheck.sh
curl -sI https://kauf-26.onrender.com/api/privacy | head -3
curl -sI https://kauf-26.onrender.com/api/terms | head -3
```

---

## Step 2: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
3. Platform: **iOS**
4. Name: **Kauf26: AI Marketplace Lister**
5. Primary Language: **English (U.S.)**
6. Bundle ID: **com.kaufai.app**
7. SKU: **kauf26-ios-2026**
8. User Access: Full Access

Copy the **Apple ID** (numeric, e.g. `1234567890`) from App Information.

Update `mobile/eas.json`:

```json
"ascAppId": "1234567890"
```

---

## Step 3: Configure App Privacy

1. App Store Connect → your app → **App Privacy**
2. Follow every answer in `docs/APP_PRIVACY_ANSWERS.md`
3. Privacy Policy URL: `https://kauf-26.onrender.com/api/privacy`

---

## Step 4: Add Metadata & Screenshots

Copy from `docs/APP_STORE_METADATA.md`:

- App name, subtitle, description, keywords
- What's New for 1.0.0
- Support URL, marketing URL, privacy URL

Upload screenshots per device sizes in metadata doc.

---

## Step 5: Build iOS Production Binary

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local

# Verify web/server build
npm run build

# Login to EAS (if needed)
cd mobile && npx eas login

# Production iOS build
npx eas build --platform ios --profile production
```

Monitor at https://expo.dev → your project → Builds.

When complete, download the `.ipa` or proceed to submit.

---

## Step 6: Submit to App Store Connect

### Option A: EAS Submit (recommended)

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local/mobile
npx eas submit --platform ios --profile production
```

### Option B: Manual upload

1. Download `.ipa` from EAS build page
2. Open **Transporter** app on Mac
3. Deliver build to App Store Connect

---

## Step 7: TestFlight QA

1. App Store Connect → **TestFlight**
2. Wait for build processing (~15–30 min)
3. Add internal testers
4. Test on physical iPhone:
   - Sign in with Apple
   - Camera capture → AI identify
   - Create listing draft
   - Settings → Privacy Policy link opens `/api/privacy`

---

## Step 8: Submit for Review

1. App Store Connect → **App Store** tab → version **1.0.0**
2. Select the TestFlight build
3. Paste **App Review Information** (below)
4. **Submit for Review**

---

## App Review Notes Template

Copy into App Store Connect → App Review Information → Notes:

```
Kauf26 is an AI-powered marketplace listing assistant for resellers.

SIGN IN
Please use Sign in with Apple on the login screen. No separate demo account is available on the production server.

HOW TO TEST
1. Open the app and tap Sign in with Apple
2. Complete onboarding if prompted
3. Tap the camera icon to capture or upload a product photo
4. Tap Identify — AI generates title, description, and price suggestion
5. Review the listing draft and explore marketplace connection options

PERMISSIONS
- Camera: scan product photos for AI listing generation
- Photo Library: select existing product images

AI FEATURES
Product images are sent to OpenAI GPT-4o for identification. Users review all AI output before publishing.

MARKETPLACE INTEGRATION
OAuth tokens for eBay/Etsy/Shopify are stored in iOS Keychain on-device. Publishing requires the reviewer to connect their own seller accounts (optional for core AI identify flow).

BACKEND
Production API: https://kauf-26.onrender.com
Health check: https://kauf-26.onrender.com/api/health
Privacy: https://kauf-26.onrender.com/api/privacy
Terms: https://kauf-26.onrender.com/api/terms

ACCOUNT DELETION
Users can delete their account from in-app Settings.

CONTACT
kaufit@yahoo.com
```

---

## Third-Party SDKs Documentation

For App Store Connect → App Information or review questions:

| SDK | Purpose | Data Access | Privacy Manifest |
|-----|---------|-------------|------------------|
| **Expo SDK** (~52) | App framework, camera, image picker | Camera, photos, secure storage | UserDefaults (CA92.1), File Timestamp (C617.1) |
| **expo-apple-authentication** | Sign in with Apple | Email, name (user consent) | — |
| **expo-camera** | Product photo capture | Camera | Camera permission string |
| **expo-image-picker** | Photo library selection | Photos | Photo library permission strings |
| **expo-secure-store** | OAuth token storage | Keychain credentials | — |
| **expo-local-authentication** | Face ID app unlock | Biometrics (optional) | Face ID permission string |
| **React Navigation** | In-app navigation | None | — |

**Server-side third parties (not embedded SDKs):**

| Service | Purpose |
|---------|---------|
| OpenAI GPT-4o | AI image identification and listing text |
| Stripe | Payment processing (server-side) |
| Apple Sign In | Authentication |
| Google OAuth | Authentication (optional) |
| eBay / Etsy / Shopify APIs | Marketplace publishing |

**Tracking:** None. No advertising SDKs. No analytics SDKs in production mobile build.

---

## eas.json — ascAppId Placeholder

The `submit.production.ios.ascAppId` field in `mobile/eas.json` is currently:

```
YOUR_APP_STORE_CONNECT_APP_ID
```

Replace with the numeric Apple ID from App Store Connect after creating the app. Find it at:

**App Store Connect → My Apps → Kauf26 → App Information → Apple ID**

Example:

```json
"ascAppId": "6748923456"
```

---

## Demo Account (Development Only)

| Field | Value |
|-------|-------|
| Email | `demo@kauf26.com` |
| Password | `DemoReview2026!` |
| Enabled when | `NODE_ENV !== production` AND `DEMO_ACCOUNT_ENABLED !== false` |
| Production | **Disabled automatically** — returns 404 |

For local testing:

```bash
# In project root .env (development only)
DEMO_ACCOUNT_ENABLED=true
NODE_ENV=development
```

Start local server, open mobile dev client pointing to local API, use Demo Sign In on login screen.

**Do not enable on Render production.** Apple reviewers use Sign in with Apple.

---

## Post-Submission Checklist

- [ ] Monitor App Store Connect for review status
- [ ] Respond to reviewer questions within 24 hours
- [ ] If rejected, read Resolution Center notes, fix, rebuild, resubmit
- [ ] On approval, release manually or set auto-release
- [ ] Verify live App Store listing URLs and privacy policy link
- [ ] Monitor crash reports and API health post-launch
- [ ] Plan version 1.0.1 for any review feedback fixes

---

## Common Rejection Reasons & Prevention

| Issue | Prevention |
|-------|------------|
| Missing privacy policy | `/api/privacy` returns full HTML ✅ |
| Privacy manifest missing API reasons | CA92.1, C617.1 declared ✅ |
| Sign in with Apple required | Implemented for apps with social login ✅ |
| Broken login on review | Test Sign in with Apple on TestFlight before submit |
| Misleading AI claims | Description says "suggestions" — user reviews before publish ✅ |
| Missing permission strings | Camera, photo library, photo library add ✅ |
| Demo account doesn't work | Document Sign in with Apple for reviewers ✅ |

---

## Quick Command Reference

```bash
# Full verification sequence
cd /Users/chriskaeufl/Desktop/Kauf26_Local
npm run build
bash render-selfcheck.sh
curl -s https://kauf-26.onrender.com/api/health
curl -s https://kauf-26.onrender.com/api/privacy | head -20

# iOS production build + submit
cd mobile
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

---

## Related Documentation

- `docs/APP_STORE_METADATA.md` — copy-paste metadata
- `docs/APP_PRIVACY_ANSWERS.md` — privacy questionnaire
- `docs/APP_STORE_SUBMISSION.md` — earlier submission notes (if present)
- `mobile/MOBILE_SUBMISSION.md` — mobile-specific env setup
- `render-selfcheck.sh` — production API verification script
