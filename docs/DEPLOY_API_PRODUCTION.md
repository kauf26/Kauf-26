# Deploy API to api.kaufai.com

**Read this first:** The `public/vercel.json` file is **only for the marketing site** (`kaufai.com`).  
The Kauf26 API is a **long-running Express + PostgreSQL** server — **do not deploy it to Vercel serverless** without a major rewrite.

| Option | Verdict | Why |
|--------|---------|-----|
| **Render** (recommended) | ✅ Use today | Docker, Postgres, custom domain, health checks |
| **Railway** | ✅ Good alternative | Similar to Render |
| **Vercel** | ❌ Not recommended | No persistent sessions/workers; function time limits |
| **AWS EC2** | ⚠️ Overkill for v1 | Full control but more ops work |

---

## 1. Current status

| Item | Status |
|------|--------|
| Apple Developer account | ✅ |
| `APPLE_CLIENT_ID` in `.env` | ✅ `com.globalmarketplacelister.app` |
| `api.kaufai.com` DNS | ⚠️ Points at Vercel — **SSL fails** (no API there) |
| Production Postgres | ❌ Need Neon or Render Postgres |
| API deployed | ❌ |

---

## 2. Recommended path: Render (today)

### Step 1 — Production database (Neon or Render)

**Option A — Neon (recommended, free tier)**

1. [console.neon.tech](https://console.neon.tech) → New project `kauf26-prod`
2. Copy connection string → `DATABASE_URL`
3. Run migrations from your Mac:

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local
export DATABASE_URL='postgresql://...neon...'
npm run db:migrate
```

**Option B — Render Postgres** (created by `render.yaml` blueprint)

Link `DATABASE_URL` from the Render database to the web service in the dashboard.

**Seed data:** None required for launch. Migrations create tables only.

---

### Step 2 — Build locally (verify before cloud deploy)

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local
npm ci
npm run build
NODE_ENV=production PORT=2626 node dist/index.cjs
# Another terminal:
curl -s http://localhost:2626/api/health
```

---

### Step 3 — Deploy to Render

1. Push repo to GitHub (if not already)
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** or **Web Service**
3. Connect repo → use root `Dockerfile`
4. Set all **secret** env vars in Render dashboard (see §4)
5. Deploy

---

### Step 4 — Custom domain `api.kaufai.com`

1. Render service → **Settings** → **Custom Domains** → Add `api.kaufai.com`
2. Add DNS **CNAME**: `api` → `your-service.onrender.com`
3. **Remove** `api.kaufai.com` from the Vercel marketing project if attached there
4. Wait for Render SSL (automatic)

> `kaufai.com` stays on Vercel. Only `api.kaufai.com` points to Render.

---

## 3. Alternative: Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway add --database postgres
railway up
```

Set env vars in Railway dashboard. Add custom domain `api.kaufai.com`.

---

## 4. Production environment variables

### Critical

```bash
NODE_ENV=production
PORT=2626
DATABASE_URL=postgresql://...
SESSION_SECRET=<openssl rand -hex 32>
SESSION_ENCRYPTION_KEY=<openssl rand -hex 32>
APP_BASE_URL=https://api.kaufai.com
CLIENT_URL=https://kaufai.com
VITE_API_URL=https://api.kaufai.com
OPENAI_API_KEY=sk-proj-...
APPLE_CLIENT_ID=com.globalmarketplacelister.app
MOCK_OAUTH_MODE=false
```

### Sign-in

```bash
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### Marketplaces

```bash
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_SANDBOX=false
ETSY_CLIENT_ID=...
ETSY_CLIENT_SECRET=...
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOPIFY_OAUTH_REDIRECT_URI=https://api.kaufai.com/api/auth/callback
```

Register in each portal: `https://api.kaufai.com/api/auth/callback`

### Payments & scrapers

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
UNIFIED_API_KEY=...
APIFY_API_KEY=...
OXYLABS_USERNAME=...
OXYLABS_PASSWORD=...
RAPIDAPI_KEY=...
```

---

## 5. Verification

```bash
curl -sS https://api.kaufai.com/api/health
curl -sS -X POST https://api.kaufai.com/api/auth/mobile/apple \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"invalid"}'
# Expect 401, NOT 503
```

---

## 6. Why NOT Vercel

- Long-running `server.listen()`
- PostgreSQL sessions (`connect-pg-simple`)
- In-process workers and 50MB uploads

Use Render/Railway for launch.
