# P1 Roadmap — Post-Launch Improvements

Non-blocking items after P0 store submission. Effort estimates assume one experienced full-stack developer familiar with this codebase.

---

## Infrastructure & security

| Item | Description | Effort |
|------|-------------|--------|
| **S3 / object storage for uploads** | Move `/uploads` local disk to S3 (or R2) for multi-instance API and durable listing images | 2–3 days |
| **CORS hardening** | Restrict `cors()` to `CLIENT_URL` + mobile origins; review preflight on OAuth routes | 0.5 day |
| **Helmet / security headers** | Add `helmet` middleware; CSP for web app | 0.5 day |
| **Rate limiting** | Express rate limit on `/api/auth/*` and publish endpoints | 1 day |
| **Structured logging** | JSON logs + request IDs for production debugging | 1 day |

---

## Marketplace integrations

| Item | Description | Effort |
|------|-------------|--------|
| **eBay inventory sync** | Implement `PUT /sell/inventory/v1/inventory_item/{sku}` (replace stub in `inventoryMarketplaceSync.ts`) | 1–2 days |
| **Shopify inventory sync** | GraphQL `inventorySetQuantities` / `inventoryAdjustQuantities` | 1–2 days |
| **Amazon SP-API publish hardening** | AWS SigV4 signing for Listings API (beyond LWA bearer token) | 3–5 days |
| **Allegro live publish** | Move from stub to OAuth + offer API | 3–5 days |
| **WooCommerce inventory** | REST `products/{id}` stock update | 1 day |

---

## Shipping & fulfillment

| Item | Description | Effort |
|------|-------------|--------|
| **Real shipping labels** | Wire EasyPost/Shippo/USPS APIs (env keys exist in `.env.example`) | 3–5 days |
| **Rate shopping UI** | Compare carrier rates in listing/shipment flow | 2 days |

---

## Mobile & UX

| Item | Description | Effort |
|------|-------------|--------|
| **Universal links (iOS)** | `https://yourdomain.com/oauth/...` → app for smoother OAuth return | 1–2 days |
| **Android App Links** | Same for Play | 1–2 days |
| **Offline draft cache** | Save drafts locally when API unreachable | 2–3 days |
| **Push notifications** | Sale / publish status via FCM + APNs | 3–5 days |

---

## Web app

| Item | Description | Effort |
|------|-------------|--------|
| **Connected accounts UX parity** | Match mobile Connections features on web Settings | 1 day |
| **Honest marketplace picker** | Hide or badge non-live platforms in `SelectMarketPlaces` | 0.5 day |

---

## Testing & CI

| Item | Description | Effort |
|------|-------------|--------|
| **E2E publish test (Etsy mock)** | Playwright/Vitest integration with mocked Etsy API | 2 days |
| **CI EAS preview builds** | GitHub Action on `main` with `EXPO_TOKEN` | 1 day |
| **Staging environment** | Separate DB + `MOCK_OAUTH_MODE` toggle for QA | 1–2 days |

---

## Documentation

| Item | Description | Effort |
|------|-------------|--------|
| **Remove legacy OAuth routes** | Deprecate `/api/oauth/*` after clients migrated | 0.5 day |
| **Update `.env.example`** | Mark `AMAZON_REFRESH_TOKEN` deprecated; document S3 vars | 0.5 day |

---

## Suggested priority order

1. CORS + helmet (quick security win)
2. S3 uploads (required before horizontal scale)
3. eBay + Shopify inventory sync (inventory story completeness)
4. Amazon SigV4 (if Amazon publish is a launch goal)
5. Shipping labels (if physical goods workflow is core)

Total P1 backlog: ~4–8 weeks depending on scope selected.
