# Handoff — Manual Deployment & Store Submission

This document is your **single checklist** to take Kauf26 from “codebase ready” to live in the App Store and Google Play. Automated checks (`npm run verify:store-readiness`) already pass locally; everything below requires **your accounts and production infrastructure**.

---

## What has been built

| Area | Status |
|------|--------|
| **Universal OAuth** | Etsy, eBay, Shopify, Amazon — server-side tokens in `marketplace_connections`, encrypted at rest |
| **Publishing** | Etsy (images + OAuth), Amazon (OAuth token, no env refresh fallback), adapters for other marketplaces |
| **Inventory sync** | Etsy live (`GET/PUT` inventory API); eBay/Shopify stubbed with TODOs |
| **Web app** | Settings → Connected Accounts, Privacy/Terms pages |
| **Mobile app** | Connections tab, Settings legal links, `kauf26://` OAuth deep links |
| **iOS compliance** | `PrivacyInfo.xcprivacy` via Expo config plugin |
| **Automation** | Deploy script, EAS build script, readiness + production validators |

**Store copy rule:** Advertise **Etsy, eBay, Shopify** only (optional Allegro if tested). Do **not** claim “26 marketplaces.”

---

## Step-by-step manual actions

### Phase 1 — Production environment (your server)

1. **Provision** PostgreSQL + a VPS/cloud host with Node 20+, HTTPS, and two domains (or subdomains):
   - API: `https://api.yourdomain.com` → `APP_BASE_URL`
   - Web: `https://yourdomain.com` → `CLIENT_URL`

2. **Configure `.env`** on the server (copy from `.env.example`). Minimum:
   - `DATABASE_URL`, `SESSION_SECRET`, `SESSION_ENCRYPTION_KEY`
   - `APP_BASE_URL`, `CLIENT_URL`, `OPENAI_API_KEY`
   - Marketplace OAuth: `ETSY_*`, `EBAY_*`, `SHOPIFY_*`, `AMAZON_*` (+ `AMAZON_SELLER_ID`)
   - Set `MOCK_OAUTH_MODE=false`

3. **Deploy backend + web:**

   ```bash
   git clone <your-repo> && cd Kauf26_Local
   cp .env.example .env    # edit with production values
   bash scripts/deploy-production.sh
   ```

   Start the API with PM2 (commands printed by the script), serve the Vite `dist/` at `CLIENT_URL`.

4. **Validate production:**

   ```bash
   # After server is running:
   bash scripts/validate-production-env.sh

   # Pre-deploy (env + DB only):
   bash scripts/validate-production-env.sh --skip-http
   ```

5. **Confirm locally:**

   ```bash
   npm run verify:store-readiness
   ```

---

### Phase 2 — Register OAuth redirect URIs

Register this **exact** callback URL in each developer portal (replace with your API domain):

```text
https://api.yourdomain.com/api/auth/callback
```

| Marketplace | Developer portal |
|-------------|------------------|
| **Etsy** | [https://www.etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps) → Your app → Redirect URI |
| **eBay** | [https://developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) → User Tokens / OAuth → RuName / redirect |
| **Shopify** | [https://partners.shopify.com](https://partners.shopify.com) → Apps → App setup → Allowed redirection URL(s) |
| **Amazon** | [https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html) → Login with Amazon → Allowed Return URLs |

Also verify:

- [ ] `APP_BASE_URL` in server `.env` matches the registered domain
- [ ] `CLIENT_URL` matches where `/privacy` and `/terms` are served
- [ ] Mobile uses the same API URL via `EXPO_PUBLIC_API_URL`

Mobile deep link `kauf26://oauth/*` is handled by the native app — **no** portal registration needed.

---

### Phase 3 — EAS secrets & mobile build

1. **Install EAS CLI and log in:**

   ```bash
   npm install -g eas-cli
   cd mobile
   eas login    # or export EXPO_TOKEN=...
   eas init     # one-time, if not done
   ```

2. **Set EAS secrets** (production HTTPS URLs — not localhost):

   ```bash
   cd mobile
   eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.yourdomain.com --type string
   eas secret:create --name EXPO_PUBLIC_WEB_BASE_URL --value https://yourdomain.com --type string
   ```

   Or use explicit legal URLs:

   ```bash
   eas secret:create --name EXPO_PUBLIC_PRIVACY_URL --value https://yourdomain.com/privacy --type string
   eas secret:create --name EXPO_PUBLIC_TERMS_URL --value https://yourdomain.com/terms --type string
   ```

3. **Update local `mobile/.env`** for validation (optional mirror of secrets):

   ```bash
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com
   EXPO_PUBLIC_WEB_BASE_URL=https://yourdomain.com
   ```

4. **Build for stores:**

   ```bash
   cd mobile
   bash scripts/build-and-submit.sh
   # Options: --ios-only, --android-only, --submit
   ```

   See [mobile/MOBILE_SUBMISSION.md](./mobile/MOBILE_SUBMISSION.md) for AAB/IPA details.

---

### Phase 4 — Manual QA

Complete every checklist item in [MANUAL_QA.md](./MANUAL_QA.md):

- OAuth connect (Etsy, eBay, Shopify, Amazon)
- Publish listing with images
- Etsy inventory sync
- Disconnect → publish fails gracefully
- Mobile deep-link OAuth

Use a **native build**, not Expo Go.

---

### Phase 5 — Store submission

#### iOS — App Store Connect

- Portal: [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- Listing copy: [STORE_LISTING_IOS.md](./STORE_LISTING_IOS.md)
- Privacy Policy URL: `https://yourdomain.com/privacy`
- Submit IPA:

  ```bash
  cd mobile
  eas submit --platform ios --profile production
  ```

#### Android — Google Play Console

- Portal: [https://play.google.com/console](https://play.google.com/console)
- Listing + data safety: [STORE_LISTING_ANDROID.md](./STORE_LISTING_ANDROID.md)
- Upload **AAB** from EAS production build
- Submit:

  ```bash
  cd mobile
  eas submit --platform android --profile production
  ```

Use **internal testing** track first; promote to production after QA sign-off.

---

## Troubleshooting

| Issue | Likely cause | Fix |
|-------|--------------|-----|
| OAuth callback 404 | Wrong `APP_BASE_URL` or route not deployed | Match `.env` to HTTPS domain; restart API |
| “Connect in Settings” on publish | No token in `marketplace_connections` | Re-connect OAuth; check `SESSION_ENCRYPTION_KEY` stable across restarts |
| Token refresh failures | Expired refresh token or revoked app | Revoke + reconnect; verify client secret; check server logs `[OAuth]` |
| Etsy publish OK, no images | Image path/upload failure | Check server logs; ensure `/uploads` or image URLs reachable from API |
| Inventory sync fails (Etsy) | Missing listing ID or OAuth | Link listing in inventory UI; verify `syncEtsyListingInventory` errors in logs |
| `validate-production-env.sh` DB fail | Wrong `DATABASE_URL` or firewall | Test `psql "$DATABASE_URL" -c 'SELECT 1'`; allow server IP on managed DB |
| `/privacy` or `/terms` not 200 | Web not deployed or wrong path | Build web (`npm run build`); serve `dist/` at `CLIENT_URL` |
| EAS build fails on legal URLs | Missing EAS secrets | Run `eas secret:create` for `EXPO_PUBLIC_WEB_BASE_URL` |
| Mobile hits localhost API | Stale build or wrong env | Rebuild after setting EAS secrets; confirm `EXPO_PUBLIC_API_URL` |
| Missing Privacy Manifest | iOS folder not prebuilt | `cd mobile && npx expo prebuild -p ios --clean` (EAS also runs prebuild) |
| Amazon publish error | Account not connected | Connect in Settings; SP-API may need additional AWS SigV4 setup (see P1) |
| `MOCK_OAUTH_MODE=true` in prod | Staging flag left on | Set `false` and redeploy |

---

## Script reference

| Command | When to run |
|---------|-------------|
| `npm run verify:store-readiness` | Before leaving dev — codebase check |
| `bash scripts/deploy-production.sh` | On server — migrate + build |
| `bash scripts/validate-production-env.sh` | On server — after deploy |
| `bash mobile/scripts/build-and-submit.sh` | After EAS login + secrets |
| `bash scripts/validate-production-env.sh --skip-http` | Pre-deploy env + DB only |

---

## Related docs

- [DEPLOY_BACKEND.md](./DEPLOY_BACKEND.md) — full deploy guide
- [MANUAL_QA.md](./MANUAL_QA.md) — QA checklist
- [STORE_LISTING_IOS.md](./STORE_LISTING_IOS.md) / [STORE_LISTING_ANDROID.md](./STORE_LISTING_ANDROID.md)
- [P1_ROADMAP.md](./P1_ROADMAP.md) — post-launch improvements
- [README.md](./README.md) — project overview

---

**You are here:** codebase ✅ → **you execute Phases 1–5 above** → live in stores 🎉
