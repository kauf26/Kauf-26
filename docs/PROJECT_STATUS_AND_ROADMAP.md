# KAUF 26 — Project Status & Implementation Roadmap

**Last updated:** June 2026  
**Purpose:** Shareable status doc for collaborators — current architecture, blockers, and prioritized path to MVP.

---

## 1. Current System Architecture Summary

### High-level layout

KAUF 26 is a **full-stack monorepo**: React (Vite) frontend, Express API, PostgreSQL via Drizzle ORM, and external scraper/publisher integrations.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Browser (localhost:5173 via `npm run dev`)                      │
│  • React UI (wouter routes in src/App.tsx)                       │
│  • ProductCamera → POST /api/* (proxied to :3000)                │
└────────────────────────────┬────────────────────────────────────┘
                             │ vite.config.ts proxy /api → :3000
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API (`npm run server` → server/index.ts :3000)          │
│  • POST /api/identify     — image → OpenAI vision → scrape → draft│
│  • /api/* via productsRoutes — drafts CRUD (Drizzle)             │
│  • registerRoutes()       — Stripe, stubs, duplicate handlers    │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  masterScraper.ts     PostgreSQL           External APIs
  (racer: Apify,       (shared/schema.ts)   (OpenAI, Apify,
   OpenAI, Oxylabs,                         RapidAPI, Stripe)
   RapidAPI)
```

### Intended user flow (camera → publish)

| Stage | Component | Endpoint / storage |
|-------|-----------|-------------------|
| 1. Capture | `src/Welcome.tsx` → `src/components/ProductCamera.tsx` | Camera / canvas |
| 2. Identify + scrape | `server/index.ts` | `POST /api/identify` (multipart) |
| 3. Scrape race | `server/scrapers/masterScraper.ts` | `scrapeProduct(query)` |
| 4. Persist draft | `server/productsRoutes.ts` | `POST /api/drafts` → `product_drafts` |
| 5. Review | `src/pages/ProductDraft.tsx` | `sessionStorage.pendingAnalysis` |
| 6. Select channels | `src/SelectMarketPlaces.tsx` | `sessionStorage` only today |
| 7. Publish | `server/marketplaceRoutes.ts` + `marketplaceWorker.ts` | **Designed but not wired** |

### Schema source of truth

- **Drizzle config:** `drizzle.config.ts` → `shared/schema.ts`
- **Drafts / publish queue:** `product_drafts`, `publish_jobs`, `publish_tasks` in `shared/schema.ts`
- **Legacy:** `server/db/schema.ts` and `migrations/0000_*.sql` reflect an older Replit schema and are **out of sync** with the app code

### Dev modes (currently inconsistent)

| Command | What runs | URL |
|---------|-----------|-----|
| `npm run dev` | Vite only | `http://localhost:5173` — **API must exist on :3000** |
| `npm run server` | Express (+ Vite middleware in dev) | `http://localhost:3000` |
| Both required today | For proxy-based workflow | 5173 UI + 3000 API |

---

## 2. Identified Blockers

### Connectivity (no API = proxy errors)

| Blocker | Symptom | Root cause |
|---------|---------|------------|
| **B1. Backend not running** | Vite log: `http proxy error: /api/identify` / `ECONNREFUSED` | Only `npm run dev` running; nothing listens on port **3000** |
| **B2. Server crash on startup** | `npm run server` exits immediately | `server/stripeClient.ts` throws if `STRIPE_SECRET_KEY` is missing (loaded via `server/routes.ts` import) |

### HTTP 500 (server reachable but handler fails)

| Blocker | Symptom | Root cause |
|---------|---------|------------|
| **B3. Missing DB tables** | 500 on `POST /api/drafts` after identify | `product_drafts` (and publish tables) not in applied migrations; `db:push` not run against current `shared/schema.ts` |
| **B4. OpenAI failure** | 500 on `POST /api/identify` | Missing/invalid `OPENAI_API_KEY` during vision step (`server/index.ts`) |
| **B5. Self-fetch draft save** | 500 if internal save fails | `server/index.ts` uses `fetch('http://localhost:3000/api/drafts')` instead of direct service call |

### Data/UI breaks (200 OK but wrong UX)

| Blocker | Symptom | Root cause |
|---------|---------|------------|
| **B6. Response shape mismatch** | Empty title/price on Product Draft | API returns `productData.modelName` / `aiDescription`; UI reads `title` / `description` (`ProductCamera.tsx`) |
| **B7. Broken text-scrape path** | Text Search fails | `masterScraperBridge.ts` → `/api/catalog/scrape` — route **not mounted**; wrong export name in `catalogRoutes.ts` |
| **B8. Auto-scrape on capture** | Double requests, race conditions | `useEffect` on `capturedImage` always calls `directImageScrape()` |

### Publishing (MVP incomplete)

| Blocker | Symptom | Root cause |
|---------|---------|------------|
| **B9. Publish API unmounted** | No marketplace jobs created | `marketplaceRoutes.ts` never registered in `server/index.ts` |
| **B10. Worker not started** | Queue never processes | `startMarketplaceWorker()` never called |
| **B11. UI doesn’t call publish** | “Publish” only navigates or stubs | `SelectMarketPlaces.tsx` → `/create`; `MarketplacePublish.tsx` POSTs wrong payload to `/api/drafts` |
| **B12. Post-to-marketplaces is cosmetic** | Status flips to `posted` only | `productsRoutes.ts` `post-to-marketplaces` — no external API or job queue |

### Code health / confusion

| Blocker | Risk |
|---------|------|
| **B13. Duplicate routes** | `server/routes.ts` duplicates `POST /api/drafts` (stub) and `POST /api/identify` (JSON-only) |
| **B14. Dual routers** | `react-router-dom` in `main.tsx` / `ProductCamera` vs **wouter** in `App.tsx` |
| **B15. Dead duplicates** | `src/server/* 2.ts` copies — easy to edit wrong file |
| **B16. Apify placeholder** | `server/scrapers/apify.ts` uses `YOUR_NEW_ACTOR_ID` — scraper quality degraded |

---

## 3. Step-by-Step Implementation Plan

Use this checklist in order. Each phase should be verifiable before moving on.

### Phase 0 — Environment & process (Day 1)

- [ ] **0.1** Ensure `.env` at repo root includes: `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `APIFY_API_KEY`, `RAPIDAPI_KEY` (and Oxylabs vars if used)
- [ ] **0.2** Add dev script to `package.json`, e.g. `"dev:all": "concurrently \"npm run server\" \"npm run dev\""` (install `concurrently` as devDependency)
- [ ] **0.3** Document for team: **either** run `dev:all` **or** run only `npm run server` and use `http://localhost:3000`
- [ ] **0.4** Verify API: `curl http://localhost:3000/api/health` returns `{"status":"ok",...}`

### Phase 1 — Database (Day 1)

- [ ] **1.1** Run `npm run db:push` with valid `DATABASE_URL` to create `product_drafts`, `publish_jobs`, `publish_tasks`
- [ ] **1.2** Confirm tables exist in Postgres (inspect DB or hit `GET /api/drafts` after Phase 2)
- [ ] **1.3** (Optional) Pass schema into `server/db.ts` via `drizzle(pool, { schema })` for type-safe queries

### Phase 2 — API stability (Days 2–3)

- [ ] **2.1** Refactor `server/stripeClient.ts` to lazy-init Stripe (or gate checkout routes) so scrape/identify works without Stripe in local dev
- [ ] **2.2** Remove stub + duplicate handlers from `server/routes.ts` (`POST /api/drafts` L71–82, `POST /api/identify` L90–137)
- [ ] **2.3** Extract draft save to `server/services/drafts.ts`; call from `server/index.ts` instead of `fetch` to self
- [ ] **2.4** Normalize `POST /api/identify` JSON response with a `product` object matching `ProductDraft.tsx` fields (`title`, `description`, `price`, etc.)
- [ ] **2.5** Fix `src/components/ProductCamera.tsx` mapping (or rely on normalized API only)
- [ ] **2.6** Remove or gate auto-scrape `useEffect` on `capturedImage`; trigger scrape via explicit button only
- [ ] **2.7** Fix `src/components/masterScraperBridge.ts` to call a real endpoint (e.g. `POST /api/scrape` with `{ query }`) or mount + fix `server/catalogRoutes.ts`

### Phase 3 — Frontend cohesion (Day 3)

- [ ] **3.1** Standardize on **wouter** — remove `BrowserRouter` from `src/main.tsx`
- [ ] **3.2** Replace `useNavigate` (react-router) with `useLocation` / `setLocation` in `Welcome.tsx` and `ProductCamera.tsx`
- [ ] **3.3** Single `QueryClientProvider` in `main.tsx` only (remove duplicate in `App.tsx`)
- [ ] **3.4** Align `src/pages/create.tsx` session keys/shape with `ProductDraft.tsx` (`pendingAnalysis` / `productListingData`)

### Phase 4 — End-to-end identify → draft (Day 4)

- [ ] **4.1** Manual test: capture image → `POST /api/identify` → 200 + row in `product_drafts`
- [ ] **4.2** Manual test: `/product-draft` shows correct title, description, price, image
- [ ] **4.3** Manual test: Continue on draft → `POST /api/drafts` persists updates
- [ ] **4.4** Configure real Apify actor ID in `server/scrapers/apify.ts` (replace placeholder)

### Phase 5 — Marketplace publish MVP (Days 5–7)

- [ ] **5.1** Mount `server/marketplaceRoutes.ts` in `server/index.ts` at `/api/marketplaces`
- [ ] **5.2** Call `startMarketplaceWorker()` after server listen in `server/index.ts`
- [ ] **5.3** Create `server/publishers/` with registry + first adapter (e.g. `ebay.ts` stub or real API)
- [ ] **5.4** Wire `marketplaceWorker.ts` `executeMarketplaceUpload` to publisher registry
- [ ] **5.5** Update `src/SelectMarketPlaces.tsx` “Publish” to `POST /api/marketplaces/publish` with `{ productData, marketplaceIds }`
- [ ] **5.6** Add job status polling UI (`GET /api/marketplaces/status/:jobId`) or merge into existing draft flow
- [ ] **5.7** Refactor `POST /api/drafts/:id/post-to-marketplaces` in `productsRoutes.ts` to enqueue jobs (not only set `status: 'posted'`)

### Phase 6 — Cleanup & hardening (Week 2)

- [ ] **6.1** Delete duplicate files under `src/server/* 2.ts`
- [ ] **6.2** Fix `package.json` `start` script to run server entry (`tsx server/index.ts` or proper build output)
- [ ] **6.3** Add `server/config/env.ts` (Zod) for fail-fast env validation with clear messages
- [ ] **6.4** Define `NormalizedProduct` in `server/types/normalizedProducts.ts` for scrape + publish contract
- [ ] **6.5** Defer or implement auth (`passport-*` in deps but no routes in `index.ts`)

### MVP definition of done

- [ ] Camera capture → identify → draft saved in Postgres  
- [ ] Product Draft page shows accurate scraped metadata  
- [ ] User selects marketplaces → publish job created → worker processes at least one channel (stub OK for demo)  
- [ ] No `ECONNREFUSED` on `/api/*` in standard dev workflow  

---

## 4. Key Recommendations

### Configuration (critical)

1. **Always run API + UI together** until a `dev:all` script exists — proxy in `vite.config.ts` assumes port **3000**.
2. **Run `db:push`** against `shared/schema.ts` before testing drafts — migrations in `migrations/` do not include MVP tables.
3. **Treat `.env` as required** for boot and identify: at minimum `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` (until Stripe is lazy-loaded).

### Refactoring (critical for stability)

| Priority | Recommendation | Files |
|----------|----------------|-------|
| **High** | Single owner per route — one `/api/identify`, one `/api/drafts` implementation | `server/index.ts`, `server/productsRoutes.ts`, delete duplicates in `server/routes.ts` |
| **High** | One router library (wouter) end-to-end | `main.tsx`, `Welcome.tsx`, `ProductCamera.tsx` |
| **High** | Shared API response contract for scrape/identify | `server/index.ts`, `ProductCamera.tsx`, `ProductDraft.tsx` |
| **Medium** | Separate scrape vs publish pipelines | `masterScraper.ts` (ingest only), `publishers/` + `marketplaceWorker.ts` (distribute) |
| **Medium** | Remove self-HTTP for draft save | New `server/services/drafts.ts` |
| **Low** | Remove `src/server` duplicate copies and unused Replit schema path | `src/server/*`, `server/db/schema.ts` (document as legacy) |

### Architecture principle for collaborators

> **Scrape** answers: “What is this product?”  
> **Publish** answers: “List it on these marketplaces.”

Keep the master scraper **racer** for unreliable external data sources. Use a **job queue + publisher registry** for marketplace listing (already sketched in `marketplaceRoutes.ts` / `marketplaceWorker.ts` — needs wiring only).

### Suggested ownership split

| Area | Primary files | Owner focus |
|------|---------------|-------------|
| DevOps / local setup | `package.json`, `.env`, `vite.config.ts` | Phase 0 |
| Backend / API | `server/index.ts`, `productsRoutes.ts`, `routes.ts` | Phases 1–2, 5 |
| Scrapers | `server/scrapers/*` | Phase 4 |
| Frontend flow | `ProductCamera.tsx`, `ProductDraft.tsx`, `SelectMarketPlaces.tsx` | Phases 3–4, 5 |
| Publishing | `marketplaceRoutes.ts`, `marketplaceWorker.ts`, `server/publishers/` | Phase 5 |

---

## Related paths (quick reference)

| Path | Role |
|------|------|
| `vite.config.ts` | Frontend port 5173, `/api` → `localhost:3000` |
| `server/index.ts` | Express entry, `/api/identify`, server listen |
| `server/productsRoutes.ts` | Draft CRUD + post-to-marketplaces |
| `server/routes.ts` | Stripe + **duplicate/stub routes** (to trim) |
| `server/scrapers/masterScraper.ts` | Scraper orchestration |
| `shared/schema.ts` | Drizzle tables for MVP |
| `src/components/ProductCamera.tsx` | Camera → API |
| `src/pages/ProductDraft.tsx` | Draft review UI |
| `src/SelectMarketPlaces.tsx` | Marketplace selection UI |

---

*For detailed file-level analysis (duplicate routes, field mappings, dependency notes), see prior engineering audit in project chat history or request an update to this doc after each phase is completed.*
