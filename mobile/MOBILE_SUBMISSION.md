# Mobile App Store Submission Guide

This document covers EAS Build setup for **Global Marketplace Lister** (Kauf26 mobile app). Do **not** commit real Apple/Google credentials or service account JSON files.

## Prerequisites

1. [Expo account](https://expo.dev/signup)
2. Apple Developer Program membership (iOS)
3. Google Play Console developer account (Android)
4. Production backend deployed with HTTPS (`APP_BASE_URL`, OAuth callbacks registered)

## 1. Install EAS CLI and log in

```bash
npm install -g eas-cli
cd mobile
eas login
```

For CI, use an [Expo access token](https://docs.expo.dev/accounts/programmatic-access/) instead of interactive login:

```bash
export EXPO_TOKEN=your_expo_token
```

## 2. Initialize EAS project (one-time)

From the `mobile/` directory:

```bash
eas init
```

This links the app to Expo and writes `extra.eas.projectId` into `app.config.js` / `app.json`. Commit the updated config **without** secrets.

If `eas init` fails with “not logged in”, run `eas login` first.

## 3. Configure production API URL

Production builds **require** `EXPO_PUBLIC_API_URL` (validated by `app.config.js` and `scripts/validate-production-env.js`).

### Local `.env` (optional, for local production-profile tests)

```bash
cp .env.example .env
# Edit mobile/.env:
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

### EAS Secrets (recommended for cloud builds)

```bash
cd mobile
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.yourdomain.com --type string
eas secret:create --name EXPO_PUBLIC_WEB_BASE_URL --value https://yourdomain.com --type string
```

**Legal URLs (required for production builds):** Set `EXPO_PUBLIC_WEB_BASE_URL` so in-app Settings links resolve to your deployed Privacy Policy and Terms pages (`/privacy`, `/terms`). Alternatively set both:

```bash
eas secret:create --name EXPO_PUBLIC_PRIVACY_URL --value https://yourdomain.com/privacy --type string
eas secret:create --name EXPO_PUBLIC_TERMS_URL --value https://yourdomain.com/terms --type string
```

Deploy the web app first so those URLs return HTTP 200 before submitting to the stores.

Optional on-device OAuth secrets (only if using legacy device token exchange):

```bash
eas secret:create --name EXPO_PUBLIC_EBAY_CLIENT_SECRET --value YOUR_EBAY_SECRET --type string
eas secret:create --name EXPO_PUBLIC_SHOPIFY_CLIENT_SECRET --value YOUR_SHOPIFY_SECRET --type string
```

Validate before building:

```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com \
EXPO_PUBLIC_WEB_BASE_URL=https://yourdomain.com \
npm run validate:production-env
```

Both `EXPO_PUBLIC_API_URL` and legal URL config are enforced for production builds (`app.config.js` + `scripts/validate-production-env.js`).

## 4. Build for stores

### Android (AAB — required for Google Play)

```bash
cd mobile
npm run build:android
# equivalent: eas build --platform android --profile production
```

Production profile uses `"buildType": "aab"` in `eas.json`.

### iOS (IPA for App Store)

```bash
cd mobile
npm run build:ios
# equivalent: eas build --platform ios --profile production
```

Download artifacts from the Expo dashboard or CLI when the build completes.

## 5. Submit credentials (placeholders in `eas.json`)

Update `mobile/eas.json` **locally** or use EAS Submit prompts. Never commit real values.

### iOS — App Store Connect

| Field | Where to find it |
|-------|-------------------|
| `appleId` | Apple ID email used for App Store Connect |
| `ascAppId` | App Store Connect → App → App Information → Apple ID (numeric) |
| `appleTeamId` | [Apple Developer](https://developer.apple.com/account) → Membership → Team ID |

```bash
eas submit --platform ios --profile production
```

### Android — Google Play

1. Play Console → Setup → API access → Create service account
2. Grant **Release manager** (or Admin) on the app
3. Download JSON key → save as `mobile/google-play-service-account.json`
4. Add to `.gitignore` (already ignored if you use `*.json` secrets locally)

Update `eas.json`:

```json
"android": {
  "serviceAccountKeyPath": "./google-play-service-account.json",
  "track": "internal"
}
```

Submit:

```bash
eas submit --platform android --profile production
```

Use `"track": "production"` only after internal/testing sign-off.

## 6. Store listing checklist

- [ ] Privacy Policy URL live (`EXPO_PUBLIC_WEB_BASE_URL` + `/privacy` or `EXPO_PUBLIC_PRIVACY_URL`)
- [ ] Terms of Service URL live (`/terms` or `EXPO_PUBLIC_TERMS_URL`)
- [ ] Set legal URL env vars **before** `eas build --profile production` (build fails if missing)
- [ ] OAuth redirect: `kauf26://oauth/{etsy|ebay|shopify|amazon}` handled by native app
- [ ] Server OAuth callback: `https://api.yourdomain.com/api/auth/callback`
- [ ] App description matches **live** marketplaces (Etsy, eBay, Shopify — see `STORE_LISTING_IOS.md` / `STORE_LISTING_ANDROID.md`)
- [ ] iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) included via prebuild plugin
- [ ] Screenshots from production build (not Expo Go)

## 7. OAuth testing note

OAuth **requires a development or production native build** with the `kauf26://` URL scheme. Expo Go cannot receive OAuth callbacks. See `docs/qa/mobile-oauth-test-plan.md`.

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails: `EXPO_PUBLIC_API_URL is required` | Set EAS secret or `.env` before `eas build --profile production` |
| Build fails: Legal URLs required | Set `EXPO_PUBLIC_WEB_BASE_URL` or both `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_TERMS_URL` |
| App hits wrong API | Rebuild after setting `EXPO_PUBLIC_API_URL`; clear app data |
| OAuth redirect fails | Confirm `APP_BASE_URL` on server and marketplace developer redirect URIs |
| `eas init` needs login | Run `eas login` or set `EXPO_TOKEN` |

## Related files

- `DEPLOY_BACKEND.md` — production server deploy guide
- `MANUAL_QA.md` — pre-submission test plan
- `STORE_LISTING_IOS.md` / `STORE_LISTING_ANDROID.md` — store copy drafts
- `mobile/app.config.js` — production env validation at build time
- `mobile/eas.json` — build profiles (Android AAB for production)
- `mobile/.env.example` — required env vars
- `mobile/src/services/config.ts` — runtime API base URL
