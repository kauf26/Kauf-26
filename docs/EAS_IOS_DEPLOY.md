# iOS deployment — EAS Build (recommended)

Use **EAS Build** for production iOS binaries. EAS manages distribution certificates and provisioning profiles for `com.kaufai.app` in the cloud.

## Prerequisites

| Item | Value / where |
|------|----------------|
| Bundle ID | `com.kaufai.app` (`mobile/app.json`) |
| Apple Team ID | `U2M253533S` |
| EAS account | `eas whoami` → logged in as **kaufai** |
| API backend | `https://kauf-26.onrender.com` (set in `eas.json` production profile) |

## Step 1 — App Store Connect API key (Fastlane metadata / submit)

1. Open [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api).
2. Copy **Issuer ID** (top of page, UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
3. Confirm your key **Key ID** is `B74FUATW27` and `.p8` file is at `mobile/fastlane/AuthKey_B74FUATW27.p8`.
4. Edit `mobile/fastlane/.env`:

```bash
APP_STORE_CONNECT_API_KEY_ID=B74FUATW27
APP_STORE_CONNECT_ISSUER_ID=<paste-issuer-id-here>
APP_STORE_CONNECT_API_KEY_PATH=./fastlane/AuthKey_B74FUATW27.p8
FASTLANE_TEAM_ID=U2M253533S
ASC_APP_ID=<numeric Apple ID from App Store Connect → App → App Information>
```

5. Test API auth (metadata only, no binary):

```bash
cd mobile
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
bundle exec fastlane ios upload_metadata skip_screenshots:true
```

## Step 2 — Configure EAS iOS credentials (interactive)

Run in **Terminal** (requires Apple ID login — cannot be automated from Cursor):

```bash
cd mobile
npx eas credentials:configure-build --platform ios --profile production
```

When prompted:

1. **Log in with Apple** — use the Apple ID linked to team `U2M253533S`.
2. Choose **Let EAS handle credentials** (recommended).
3. Confirm bundle identifier **`com.kaufai.app`**.
4. EAS will create or reuse:
   - Distribution certificate
   - App Store provisioning profile

Verify:

```bash
npx eas credentials --platform ios --profile production
```

## Step 3 — Production build

```bash
cd mobile
npx eas build --platform ios --profile production
```

- Build runs on Expo servers (~15–25 min).
- Track progress at [expo.dev](https://expo.dev) → project **global-marketplace-lister**.
- Download the `.ipa` when complete.

## Step 4 — Submit to App Store Connect

```bash
npx eas submit --platform ios --profile production --latest
```

Or submit a downloaded IPA:

```bash
bundle exec fastlane ios submit_eas_ipa ipa_path:~/Downloads/KaufAI.ipa skip_screenshots:true
```

## Local Fastlane `deploy` (optional, not recommended)

Local `gym` builds need Xcode signing on your Mac. The Fastfile now:

- Targets **`com.kaufai.app`** everywhere
- Auto-runs `expo prebuild --clean` if `ios/` still has `com.globalmarketplacelister.app`
- Passes `PRODUCT_BUNDLE_IDENTIFIER=com.kaufai.app` to Xcode

```bash
bundle exec fastlane ios prebuild   # regenerate ios/ only
bundle exec fastlane ios deploy     # local build + upload (needs signing + Issuer ID)
```

Prefer **`bundle exec fastlane ios eas_production`** to print the EAS command checklist.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `No profiles for com.globalmarketplacelister.app` | Run `bundle exec fastlane ios prebuild` or use EAS Build |
| `APP_STORE_CONNECT_ISSUER_ID is not set` | Paste Issuer ID into `fastlane/.env` |
| EAS credentials prompt fails in CI/Cursor | Run `eas credentials:configure-build` in your Mac Terminal |
| `ascAppId` wrong on submit | Update `mobile/eas.json` → `submit.production.ios.ascAppId` with numeric Apple ID from App Store Connect |
