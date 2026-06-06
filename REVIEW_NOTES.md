# Kauf26 — Identification & Publishing Review Notes

**Date:** 2026-06-01  
**Scope:** Product identification pipeline + multi-marketplace publishing  
**Note:** There are no `identify.js`, `masterScraper.js`, or `scraper.js` files. The live implementation is **TypeScript** under `server/` and `src/`.

---

## 1. File map (what actually exists)

### Product identification

| Role | Primary file(s) |
|------|-----------------|
| HTTP entry (`POST /api/identify`) | `server/index.ts` → `runIdentifyPipeline()` |
| Identify job queue (FIFO, 120s timeout) | `server/identifyQueue.ts` |
| Vision (OpenAI GPT-4o image → JSON) | `server/index.ts` (`VISION_IDENTIFY_PROMPT`, `parseVisionResponse`) |
| Scraper orchestration | `server/scrapers/masterScraper.ts` |
| Parallel scraper race | `server/scrapers/scraperRace.ts` |
| Google Search (Apify) | `server/scrapers/googleSearchApify.ts` |
| Google Custom Search | `server/scrapers/googleShopping.ts` |
| Google Lens (Apify) | `server/scrapers/googleLens.ts` |
| Listing aggregation / median price | `server/scrapers/listingUtils.ts` |
| Vision token / exact-rank scoring | `server/scrapers/visionMatch.ts` |
| Organic URL filtering | `server/scrapers/productPageFilter.ts` |
| Match validation | `server/scrapers/validateMatch.ts` |
| Vision ↔ scraper title override gate | `server/scrapers/exactMatchGate.ts` |
| Luxury watch pricing | `server/scrapers/luxuryPricing.ts` |
| Category fallback pricing | `server/scrapers/fallbackPricing.ts` |
| URL stripping before save | `server/listingSanitizer.ts` |
| Draft persistence | `server/productsRoutes.ts` (`POST /api/drafts`) |
| Camera UI | `src/components/ProductCamera.tsx` |

### Marketplace publishing

| Role | Primary file(s) |
|------|-----------------|
| Publish config (6 platforms) | `server/config/marketplaces.ts` |
| Publish engine (parallel `allSettled`) | `server/services/publishEngine.ts` |
| Adapter registry | `server/services/adapters/index.ts` |
| eBay adapter | `server/services/adapters/ebayAdapter.ts` |
| Allegro adapter | `server/services/adapters/allegroAdapter.ts` |
| Facebook adapter | `server/services/adapters/facebookAdapter.ts` |
| Web-only stubs (Poshmark, Mercari, OfferUp) | `server/services/adapters/webAdapter.ts` |
| Thin facade / payload mapping | `server/publishToMarketplaces.ts` |
| HTTP API | `server/marketplaceRoutes.ts` |
| Async worker + retries | `server/marketplaceWorker.ts` |
| Per-task rate limit / retry cap | `server/queueManager.ts` |
| CLI | `scripts/kauft.ts` (`npm run kauft -- publish …`) |
| Tests (mocked APIs) | `server/services/publishEngine.test.ts` |
| DB tables | `shared/schema.ts` → `publish_jobs`, `publish_tasks`, `product_drafts` |

### Separate / not wired to publish engine

| File | Purpose |
|------|---------|
| `src/config/marketplaces.ts` | UI list of **26** aspirational marketplaces (Shopify, Amazon, StockX, …) — **not** used by `publishEngine` |
| `src/marketplaces.ts`, `src/MarketplacePublish.tsx` | Frontend marketplace selection UI |
| `scripts/publish-draft.ts` | Legacy queue-only CLI (superseded by `kauft publish` for sync runs) |

---

## 2. Identification pipeline (current flow)

```
Camera image
    → POST /api/identify (queued, max 120s)
    → OpenAI Vision (gpt-4o, 10s cap)
    → masterScraper.scrapeProduct()
         Stage 1: Google Lens (Apify, 5–15s cap)
         Stage 2: apify Google Search ∥ Google Custom Search (45s race window)
    → scraperHasUsableProduct() ?
         YES → mergeVisionAndScraper()
         NO  → buildVisionFallback()
    → Save draft (status: requires_review | ready_for_posting)
    → JSON response to frontend
```

### Vision layer (`server/index.ts`)

- **Only hard failure before draft:** missing image, vision timeout (422), or vision JSON without a title (422).
- Extracts: `title`, `brand`, `category`, `condition`, `material`, `color`, `style`, `description`, `confidence`.
- Scraper errors **do not** fail the request; they are caught and `scrapedRaw` is set to `null`.

### Master scraper (`server/scrapers/masterScraper.ts`)

**Stage 1 — Google Lens** (if `APIFY_API_KEY` + image present):

- Actor: `prodiger/google-lens-scraper`.
- Logs have shown the actor exiting with **0 dataset items** (“per-mode clients are not fully wired yet”), so Stage 1 often contributes nothing.
- 5s default actor wait; phase timeout 4–15s; frequently times out before cold-start completes.

**Stage 2 — Keyword race** (sources in production path: `apify`, `google`):

| Source | Dependency | Typical behavior |
|--------|------------|------------------|
| `apify` | `APIFY_API_KEY` | `apify/google-search-scraper`; cold starts ~10–30s; main source of prices |
| `google` | `GOOGLE_API_KEY` + `GOOGLE_CX` | **Skipped** when env vars missing (logs: “GOOGLE_API_KEY or GOOGLE_CX missing”) |
| `ebay`, `rapidapi`, `oxylabs`, `openai` | Various | Registered in scraper map but **not** in the Stage 2 race runners list |

**Candidate filtering (`scraperRace.ts` → `toCandidate`):**

- `brandsConflict()` can reject otherwise-good listings (e.g. parsed brand `"Pre"` from “Pre-Owned Rolex…”, or `"Hats"` from collection pages). Recent fixes use `titleMentionsBrand()` and unreliable-brand allowlists, but category-page titles still slip through.
- `validateMatch.ts` can reject low `brandPct` even when Apify marks a row as exact.

**When race produces zero candidates:**

```text
mergeSimilarProduct({
  title: visionTitle,
  brand: visionBrand,
  price: 0,
  scraperSource: "openai",
  isExactMatch: false,
  matchType: "similar"
})
```

**On uncaught scraper exception:** returns `null` (identify continues with vision-only).

**When race has a winner but not exact:** returns `mergeSimilarProduct` with `isExactMatch: false` (often `priceReliable: false`).

---

## 3. Scraper fallback — how it works (and where it fails)

### Gate: `scraperHasUsableProduct()` (`server/index.ts`)

A scraper result is considered **usable** only if:

1. `isExactMatch === true` OR `matchType === "exact"`, **and**
2. Price rules:
   - **Luxury watch** (via `detectLuxuryProfile`): `isPriceSaneForLuxury(price)` (≥ $500) **or** `price === 0`
   - **Everything else:** `price >= 5`

**Implication:** A valid **similar** match with a real price is **never** merged; identify always falls back to vision pricing.

### Path A — Vision fallback (`buildVisionFallback`)

Triggered when: scraper is `null`, not exact, exact with bad luxury price, or exact with `price === 0` (non-luxury fails the `>= 5` check).

- Sets `requiresManualReview: true`, `matchType: "generic"`, `priceReliable: false`.
- Price from `getFallbackPriceRange(category, title, brand)`:
  - **Luxury brand detected** (Rolex, Omega, …): ~$9,500 suggested for Rolex (from `luxuryPricing.ts`).
  - **Generic watch** (no luxury brand in text): **$75–$500, suggested $180** — still a risk for homage watches without brand.
  - **Clothing / caps:** $15–$50, suggested $28.
- Enriches brand/model via `extractBrandModelFromTitle` + iconic model regex.
- Draft status: **`requires_review`** (when `fallbackToVision` or `requiresManualReview`).

### Path B — Scraper merge (`mergeVisionAndScraper`)

Triggered when `scraperHasUsableProduct` passes.

- **Vision-first for attributes:** `material`, `color`, `style`, `description` always prefer vision.
- **Title/brand/model override** only if `canScraperOverrideVision()` passes (`exactMatchGate.ts`):
  - ≥90% token match **or** luxury exact + ≥75% token coverage.
  - Price in resale band: **$5–$500** generic; luxury uses per-brand market band (e.g. Rolex $5k–$20k).
  - Luxury price must be ≥ $500 sanity floor.
- If override blocked but scraper has sane luxury price: vision title kept, scraper price applied, `requiresManualReview: true`.
- Partial luxury title upgrade: if coverage ≥75%, scraper title longer than vision → keep detailed scraper title.

### Path C — Master scraper internal fallback (before identify merge)

Even when Apify finds exact matches, `brandsConflict` in the race can zero out candidates → masterScraper returns Path C object (`price: 0`, `openai` source) → identify treats as **not usable** → Path A vision fallback.

### Frontend (`ProductCamera.tsx`)

- Proceeds to draft when `success && draftId`, `requiresManualReview`, or `fallbackToVision`.
- Scraper failure no longer shows “Failed to process image with scraper” if API returns `success: true`.

### Remaining failure modes (observed in logs)

| Symptom | Cause |
|---------|--------|
| Rolex at **$180** | Vision fallback with generic watch band because luxury `detectLuxuryProfile` missed (no brand in vision title) **or** scraper never marked exact |
| Exact Apify match discarded | `brandsConflict` in race after `validateMatch` accepted |
| Category page as “exact” | “Pre-Owned Rolex Submariner Watches” — high token rank but not a SKU listing |
| Identify queue **504** | Job timeout 120s vs scraper race 45s + Apify cold start + vision; tight under load |
| Google Lens always empty | Apify actor not producing items |
| Google Custom Search never runs | Missing `GOOGLE_API_KEY` / `GOOGLE_CX` |

---

## 4. Price sanity checks — where implemented

| Layer | File | What it does |
|-------|------|----------------|
| **Luxury detection & bands** | `server/scrapers/luxuryPricing.ts` | `detectLuxuryProfile()`, `isPriceSaneForLuxury()` (min **$500**), `isPriceInLuxuryMarketBand()`, `filterLuxuryListingPrices()` |
| **Category / vision fallback** | `server/scrapers/fallbackPricing.ts` | Delegates to luxury profile first; else category heuristics (watch **$180** default, caps **$28**, etc.) |
| **Scraper override gate** | `server/scrapers/exactMatchGate.ts` | `priceInResaleBand()`: generic **$5–$500**; luxury uses market band + sanity |
| **Identify merge** | `server/index.ts` | `resolveScraperPrice()`, `scraperHasUsableProduct()`, merge branch for bad luxury price → `fallbackSuggested` |
| **Organic filtering** | `server/scrapers/googleSearchApify.ts` | Zeroes luxury listings priced &lt; $500 before aggregation |
| **Median aggregation** | `server/scrapers/listingUtils.ts` | `filterLuxuryListingPrices()` on peer prices before median; `MIN_PRICED_LISTINGS = 2` for `priceReliable` |
| **Product page filter** | `server/scrapers/productPageFilter.ts` | Rejects social/menu URLs, `/collections/` pages; requires marketplace or product structure + price ≥ $5 for non-marketplace URLs |

**Gap:** Generic watches without a detectable luxury brand still fall back to **$180**. Homage/submariner-style titles without “Rolex” in vision text bypass luxury logic.

---

## 5. Marketplace configuration

### Authoritative publish config — `server/config/marketplaces.ts`

| Name | Enabled | API | Auth | Adapter status |
|------|---------|-----|------|----------------|
| **ebay** | ✅ | REST | OAuth | Implemented (`ebayAdapter.ts`); dry-run without creds |
| **allegro** | ✅ | REST | OAuth (client credentials) | Implemented (`allegroAdapter.ts`); dry-run without creds |
| **facebook** | ✅ | Graph | OAuth (access token) | Implemented (`facebookAdapter.ts`); catalog products API |
| **poshmark** | ❌ | web | none | Stub — manual export only |
| **mercari** | ❌ | web | none | Stub — manual export only |
| **offerup** | ❌ | web | none | Stub — manual export only |

**Defaults:** `DEFAULT_PUBLISH_MARKETPLACES` env (e.g. `ebay,allegro,facebook`).

**API surface:**

- `POST /api/marketplaces/publish` — `{ draftId, marketplaces?, sync? }` → job ID (+ outcomes if `sync: true`)
- `GET /api/marketplaces/status/:jobId`
- `GET /api/marketplaces/config`
- CLI: `npm run kauft -- publish <draftId> --marketplaces ebay,allegro`

### Frontend / aspirational list — `src/config/marketplaces.ts`

26 marketplaces (Shopify, Amazon, StockX, Depop, …) for UI only. **Not connected** to `publishEngine` or adapters.

---

## 6. Publishing architecture (current state)

```
draftId
  → publishEngine.publishDraft()
       → load product_drafts row
       → draftToPublishPayload()
       → resolveMarketplaceTargets()
       → create publish_jobs + publish_tasks (pending)
       → if sync: Promise.allSettled → publishOne() per marketplace
       → else: worker picks tasks later

marketplaceWorker (poll 10s)
  → one task at a time (sequential)
  → exponential backoff on failed retries (1s, 2s, 4s … max 30s)
  → max 3 attempts (PUBLISH_MAX_ATTEMPTS)
```

### Adapter behavior (without credentials)

All three REST/Graph adapters **dry-run**: log payload, return stub `listingId`, `success: true`, `dryRun: true`. CLI shows `○` (dry-run) not `✓` (live).

### Required env vars (`.env.example`)

**eBay:** `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN`, optional `EBAY_*_POLICY_ID`, `EBAY_SANDBOX`  
**Allegro:** `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`  
**Facebook:** `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_CATALOG_ID`

---

## 7. Main bottlenecks preventing reliable publishing

### A. Credentials & OAuth (blocking live posts)

- No OAuth tokens configured in typical local `.env` → **100% dry-run**.
- eBay requires **fulfillment, payment, and return policy IDs** for `createOffer` / `publishOffer`; missing policies cause live API failures even with a refresh token.
- Allegro client-credentials flow may not match seller account setup for all offer types.
- Facebook adapter uses **Catalog API** (`/{catalog-id}/products`), not consumer Marketplace listing creation — needs commerce eligibility and is not the same as “post to Marketplace.”

### B. Image & payload gaps

- Draft images are stored as **base64 data URLs** in PostgreSQL.
- eBay adapter sets `imageCount` but **does not upload images** to eBay Picture Services.
- Allegro adapter references images in format but **does not upload** to Allegro image API (requires hosted URLs).
- Facebook catalog expects product fields; base64 not sent in Graph payload.
- Single default eBay `categoryId` (93427) for all products — wrong category for many items.

### C. Async worker throughput

- `marketplaceWorker` processes **one task per 10s poll**, not parallel per job.
- API default (`sync: false`) queues tasks; user must wait for worker or poll status.
- `publishEngine` parallel path only runs on CLI (`sync: true`) or explicit API `sync: true`.

### D. Identification → publish data quality

- `requires_review` drafts still publishable but prices may be **estimates** (`priceReliable: false`).
- `marketPrices.recommendedPrice` drives adapter price; vision fallback values propagate to live listing attempts.
- No pre-publish validation gate (e.g. block publish if `priceReliable === false` unless forced).

### E. Disabled / stub marketplaces

- Poshmark, Mercari, OfferUp have **no public API** — disabled in config; stubs only.
- User expectation of “simultaneous publish to 6 platforms” is really **3 API + 3 manual/disabled**.

### F. Config fragmentation

- Three marketplace lists: `server/config/marketplaces.ts` (6), `src/config/marketplaces.ts` (26), `.env` defaults — easy for UI and backend to disagree.

### G. Scraper reliability (upstream of publish)

- Weak marketplace matches → estimated prices → unreliable listings on eBay/Allegro.
- Apify latency + 45s race window → frequent vision-only path.
- Google Lens non-functional → no visual exact-match shortcut.

---

## 8. Tests & observability

| Tool | Status |
|------|--------|
| `npm run test:publish` | 3 vitest cases — parallel dry-run, partial failure isolation, mocked eBay+Allegro success |
| `IDENTIFY_DEBUG=true` | Verbose merge logging (`server/scrapers/scrapeDebug.ts`) |
| `npm run scrape:debug` | Scraper + override gate without camera |

**Not covered:** End-to-end identify → draft → publish integration test; real OAuth flows; image upload paths.

---

## 9. Summary

**Identification** is vision-first with a sophisticated but fragile scraper stage. Fallback **does work** for draft creation when scraper fails (vision-only, `requires_review`, category pricing), but **usable scraper merge** requires an exact match with passing price gates — similar matches and brand-conflict rejections still push common products to estimated prices.

**Publishing** infrastructure exists (config, adapters, engine, queue, CLI, API, tests) but **live multi-marketplace publish is blocked** by missing OAuth credentials, image upload gaps, policy IDs, Facebook catalog vs Marketplace mismatch, sequential worker processing, and upstream price/title quality from identification.

**Recommended next focus areas** (for future work, not implemented here):

1. Wire image upload for eBay / Allegro before `createOffer`.
2. Unify marketplace config (single source for UI + backend).
3. Allow similar + `priceReliable` matches to merge without requiring `isExactMatch`.
4. Fix or replace Google Lens actor; enable Google Custom Search API.
5. Pre-publish validation + sandbox mode toggle per marketplace.
6. Parallel worker execution per `jobId` (not one global task every 10s).
