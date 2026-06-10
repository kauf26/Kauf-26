# Backend Production Deployment Guide

Deploy the Kauf26 API + web app before mobile store submission. Mobile builds require a **HTTPS** API (`EXPO_PUBLIC_API_URL`) and registered OAuth redirect URIs.

---

## 1. Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL database (Neon, RDS, or self-hosted)
- HTTPS reverse proxy (nginx, Caddy, or cloud load balancer)
- Domain, e.g. `api.yourdomain.com` (API) and `yourdomain.com` (web/Vite static)

---

## 2. Required environment variables

Copy `.env.example` to `.env` on the server. **Minimum for production:**

### Core (required)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret (long random string) |
| `SESSION_ENCRYPTION_KEY` | 32-byte AES key (64-char hex or base64) — encrypts OAuth tokens at rest |
| `APP_BASE_URL` | Public API URL, e.g. `https://api.yourdomain.com` (no trailing slash) |
| `CLIENT_URL` | Web app origin for OAuth success redirects, e.g. `https://yourdomain.com` |
| `PORT` | Listen port (default `2626`; proxy terminates TLS) |

### Auth (required if using Google/Apple login)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Web sign-in |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple sign-in (optional if not used) |

### OAuth marketplaces (required for live connect/publish)

Register **`{APP_BASE_URL}/api/auth/callback`** in each developer portal (see §5).

| Variable | Marketplace |
|----------|-------------|
| `ETSY_CLIENT_ID` / `ETSY_CLIENT_SECRET` | Etsy |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | eBay |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Shopify |
| `AMAZON_CLIENT_ID` / `AMAZON_CLIENT_SECRET` / `AMAZON_SELLER_ID` | Amazon SP-API |

Optional overrides: `ETSY_SHOP_ID`, `EBAY_SANDBOX`, `AMAZON_SANDBOX`, `AMAZON_MARKETPLACE_ID`, policy IDs for eBay.

**Note:** Amazon publish uses OAuth tokens from `marketplace_connections`; `AMAZON_REFRESH_TOKEN` in `.env` is legacy and not required when users connect via Settings.

### AI / identify (required for product identification)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Vision + listing copy |

### Mobile (EAS build-time — not on server `.env`)

Set in **EAS Secrets** or `mobile/.env` (see `mobile/.env.example`):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Same as `APP_BASE_URL`, e.g. `https://api.yourdomain.com` |
| `EXPO_PUBLIC_WEB_BASE_URL` | Web origin for in-app Privacy/Terms links, e.g. `https://yourdomain.com` |
| `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` | Optional overrides for legal URLs |

### Optional but recommended

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `MOCK_OAUTH_MODE=true` | Staging only — simulates OAuth without live keys |
| `VITE_API_URL` | Build-time web client API URL (usually same as `APP_BASE_URL`) |
| Scraper keys (`APIFY_API_KEY`, etc.) | Price research |

See `.env.example` for the full list of 26 marketplace credential blocks (most are stubs until implemented).

---

## 3. Build and deploy

```bash
# On the server or CI
git clone <repo> && cd Kauf26_Local
npm ci
cp .env.example .env   # edit with production values

# Run database migrations (see §4)
npm run db:migrate

# Build web + server
npm run build

# Start API (see §5 for process management)
npm start
# Listens on PORT (default 2626)
```

Serve the Vite `dist/` folder from `yourdomain.com` (nginx static or CDN). Proxy `/api` to the Node process if API and web share a domain.

**Health check:** `GET https://api.yourdomain.com/api/health` (or any known route).

---

## 4. Database migrations

Ensure `DATABASE_URL` is set, then:

```bash
npm run db:migrate
```

This runs `drizzle-kit migrate` against the `migrations/` folder.

**Supplemental SQL:** If your database was created before Drizzle journal entries, apply dated files manually once:

```bash
psql "$DATABASE_URL" -f migrations/20260609_marketplace_connections.sql
psql "$DATABASE_URL" -f migrations/20260610_sales_tracking.sql
psql "$DATABASE_URL" -f migrations/20260610_shipping_labels.sql
psql "$DATABASE_URL" -f migrations/20260611_marketplace_auth.sql
```

For schema drift during development only: `npm run db:push` (not recommended on production without review).

---

## 5. Process management

Run the API under a supervisor so it restarts on crash and survives reboots.

### Option A — PM2 (recommended)

```bash
npm install -g pm2
pm2 start dist/index.js --name kauf26-api --env production
pm2 save
pm2 startup   # follow printed instructions for boot persistence
```

With env file:

```bash
pm2 start dist/index.js --name kauf26-api --env production --update-env
# Ensure .env is loaded (use dotenv in app or pm2 ecosystem file)
```

Example `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [{
    name: "kauf26-api",
    script: "dist/index.js",
    cwd: "/var/www/kauf26",
    env: { NODE_ENV: "production", PORT: 2626 },
    instances: 1,
    autorestart: true,
    max_memory_restart: "512M",
  }],
};
```

### Option B — systemd

```ini
# /etc/systemd/system/kauf26-api.service
[Unit]
Description=Kauf26 API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kauf26
EnvironmentFile=/var/www/kauf26/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable kauf26-api
sudo systemctl start kauf26-api
```

### Workers / queues

Publish and identify queues run **in-process** on the same Node server. Scale by running additional PM2 instances only if you add shared queue storage (not required for initial launch). Monitor logs for `[Publish]` and `[OAuth]` errors.

---

## 6. OAuth redirect URI checklist

Use your real API domain. Replace `your-api-domain.com` below.

| Marketplace | Redirect URI to register |
|-------------|--------------------------|
| **Unified (all)** | `https://your-api-domain.com/api/auth/callback` |
| Etsy | Same (Etsy Developer → Your app → Redirect URI) |
| eBay | Same (+ legacy `https://your-api-domain.com/api/oauth/ebay/callback` if needed) |
| Shopify Partners | Same (App setup → Allowed redirection URL(s)) |
| Amazon SP-API / LWA | Same (Login with Amazon → Allowed Return URLs) |

### Pre-launch checklist

- [ ] `APP_BASE_URL=https://your-api-domain.com` in production `.env`
- [ ] `CLIENT_URL=https://yourdomain.com` matches deployed web app
- [ ] HTTPS certificate valid on API and web
- [ ] Redirect URI registered for **Etsy**, **eBay**, **Shopify**, **Amazon**
- [ ] Mobile deep link scheme `kauf26://oauth/*` handled by native app (no portal registration)
- [ ] Test OAuth: web Settings → Connect Etsy → callback succeeds
- [ ] Test OAuth: mobile Connections tab → Connect → returns to app
- [ ] `SESSION_SECRET` and `SESSION_ENCRYPTION_KEY` set (never commit)
- [ ] `MOCK_OAUTH_MODE=false` in production

---

## 7. Post-deploy verification

```bash
# From your machine
curl -sS https://api.yourdomain.com/api/marketplaces/oauth-config | head
curl -sS -o /dev/null -w "%{http_code}" https://yourdomain.com/privacy
curl -sS -o /dev/null -w "%{http_code}" https://yourdomain.com/terms
```

- [ ] Web Privacy Policy and Terms pages load (200)
- [ ] OAuth connect works for at least one marketplace
- [ ] Publish dry-run or live test on Etsy with images
- [ ] Mobile app points to production API (`EXPO_PUBLIC_API_URL`)

---

## Related docs

- `mobile/MOBILE_SUBMISSION.md` — EAS build and store upload
- `MANUAL_QA.md` — pre-submission test plan
- `DEPLOY_BACKEND.md` (this file)
- `.env.example` — full variable reference
