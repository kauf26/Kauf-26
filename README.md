# Kauf26

AI-powered marketplace listing tool — identify products from photos, create drafts, and publish to connected seller accounts (Etsy, eBay, Shopify).

## 🚀 Final Steps

**Automated readiness checks pass.** To deploy and submit to the App Store / Google Play, follow the handoff guide:

👉 **[HANDOFF_TO_USER.md](./HANDOFF_TO_USER.md)** — step-by-step commands, OAuth portal links, EAS secrets, and store submission.

Quick validation on your server after deploy:

```bash
bash scripts/validate-production-env.sh
```

Monorepo layout (npm workspaces — see [docs/MONOREPO.md](./docs/MONOREPO.md)):

| Path | Package | Purpose |
|------|---------|---------|
| `server/` | (root) | Express API, OAuth, publish queue |
| `src/` | (root) | Vite web app |
| `mobile/` | `global-marketplace-lister` | Expo React Native app |
| `shared/` | `@kauf26/shared` | Drizzle schema + shared logic |

## Development

```bash
npm install                   # root + mobile + shared (workspaces)
cp .env.example .env          # configure DATABASE_URL, keys, etc.
npm run server                # API on :2626
npm run dev                   # web on :5173
npm run mobile:start          # Expo Metro (or npm run dev:all for everything)
```

## Store Submission Checklist

Use the automation scripts and guides below before uploading to App Store Connect and Google Play.

### 1. Validate readiness

```bash
npm run verify:store-readiness
# Skip tests: npm run verify:store-readiness -- --skip-tests
```

Prints a green/red report for backend env, mobile env, docs, tests, and iOS privacy manifest.

### 2. Deploy backend

```bash
cp .env.example .env          # production values on server
bash scripts/deploy-production.sh
```

See [DEPLOY_BACKEND.md](./DEPLOY_BACKEND.md) for full details (PM2, migrations, OAuth redirect URIs).

### 3. Build mobile (EAS)

```bash
cd mobile
cp .env.example .env          # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WEB_BASE_URL
eas login                     # or EXPO_TOKEN
bash scripts/build-and-submit.sh
# Options: --ios-only, --android-only, --submit
```

See [mobile/MOBILE_SUBMISSION.md](./mobile/MOBILE_SUBMISSION.md).

### 4. Manual QA

Complete [MANUAL_QA.md](./MANUAL_QA.md) — OAuth connect, publish with images, inventory sync, disconnect flows.

### 5. Store listings

| Platform | Guide |
|----------|--------|
| iOS | [STORE_LISTING_IOS.md](./STORE_LISTING_IOS.md) |
| Android | [STORE_LISTING_ANDROID.md](./STORE_LISTING_ANDROID.md) |

**Do not claim “26 marketplaces”** — limit copy to Etsy, eBay, Shopify (plus Allegro only if tested).

### 6. Post-launch (optional)

[P1_ROADMAP.md](./P1_ROADMAP.md) — S3 uploads, CORS/helmet, eBay/Shopify inventory, shipping labels.

---

### Personal checklist (cannot be automated)

- [ ] Register `https://your-api-domain.com/api/auth/callback` with **Etsy, eBay, Shopify, Amazon**
- [ ] Deploy API + web with HTTPS; `/privacy` and `/terms` live
- [ ] `npm run verify:store-readiness` → **READY**
- [ ] `MANUAL_QA.md` signed off
- [ ] EAS production builds (iOS IPA + Android AAB)
- [ ] App Store Connect + Play Console listings uploaded
- [ ] `eas submit` or manual upload to stores
- [ ] Internal/test track review before production rollout

### Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/verify-store-readiness.js` | Pre-flight validator |
| `scripts/validate-production-env.sh` | Production server env + DB + HTTP check |
| `scripts/deploy-production.sh` | Migrate, build, print PM2 + OAuth checklist |
| `mobile/scripts/build-and-submit.sh` | EAS build + optional submit |
| `mobile/scripts/validate-production-env.js` | Mobile production env gate |
