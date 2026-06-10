# Manual QA Test Plan — Pre–Store Submission

Run this checklist before EAS production builds and store upload. Requires **native builds** (development or production profile)—Expo Go cannot receive `kauf26://` OAuth callbacks.

**Environment options:**

- **Live keys:** Production or staging server with real OAuth client IDs
- **Mock mode:** Set `MOCK_OAUTH_MODE=true` on server when marketplace keys are missing (simulates connect/token flow)

**Setup:**

```bash
npm run test -- --run          # automated regression
cd mobile && npx tsc --noEmit  # mobile typecheck
```

Server running with `APP_BASE_URL` matching device-reachable URL. Mobile `.env`:

```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com   # or LAN IP for dev
EXPO_PUBLIC_WEB_BASE_URL=https://yourdomain.com
```

---

## 1. OAuth connect — Etsy

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Web: Settings → Connected Accounts → **Connect Etsy** | Browser opens Etsy authorize |
| 1.2 | Approve access | Redirect to `{APP_BASE_URL}/api/auth/callback` → success page or app |
| 1.3 | Refresh Connected Accounts | Etsy shows **Connected** |
| 1.4 | Mobile: Connections tab → **Connect Etsy** | Safari/Chrome auth → returns to app via `kauf26://oauth/etsy?...` |
| 1.5 | Mock mode (`MOCK_OAUTH_MODE=true`) | Connect succeeds without real Etsy keys; token stored |

- [ ] Pass / Fail: _______
- [ ] Notes: _______

---

## 2. OAuth connect — eBay

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Connect eBay (web) | eBay sign-in → callback success |
| 2.2 | Connect eBay (mobile) | Deep link return; status Connected |
| 2.3 | Revoke (web Settings) | Status disconnected; mobile reflects after refresh |

- [ ] Pass / Fail: _______

---

## 3. OAuth connect — Shopify

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Enter shop domain (if prompted) | Valid `.myshopify.com` shop |
| 3.2 | Connect (web + mobile) | OAuth completes; shop name shown |
| 3.3 | HMAC / callback | No 403 on callback (server validates Shopify HMAC) |

- [ ] Pass / Fail: _______

---

## 4. OAuth connect — Amazon

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Connect Amazon (web or mobile) | LWA consent → callback success |
| 4.2 | Verify token in DB / connections API | `GET /api/auth/connections` includes amazon |
| 4.3 | Publish without connect | Error: *Amazon account not connected. Please connect in Settings.* |

- [ ] Pass / Fail: _______

---

## 5. Publish listing with images (Etsy — primary path)

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Create draft with 1–3 product photos | Draft saved with images |
| 5.2 | Select Etsy; publish | No dry-run if OAuth connected |
| 5.3 | Check server logs | Etsy create listing + image upload calls |
| 5.4 | Open Etsy seller dashboard / listing URL | Draft listing exists with images |
| 5.5 | Publish without Etsy connected | Clear error or dry-run message |

- [ ] Pass / Fail: _______
- [ ] Listing ID: _______

**Optional:** Repeat publish smoke test for eBay or Shopify if configured.

---

## 6. Inventory sync (Etsy)

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Link inventory pool to Etsy listing ID (via app inventory flow) | Listing associated in DB |
| 6.2 | Change central quantity (e.g. 5 → 2) | Server calls Etsy `GET/PUT .../listings/{id}/inventory` |
| 6.3 | Verify on Etsy | Quantity matches (or Etsy API reflects update) |
| 6.4 | Set quantity to 0 | Out-of-stock handling; no crash |
| 6.5 | Etsy not connected | Error message; no silent success |

- [ ] Pass / Fail: _______

**Note:** eBay/Shopify inventory sync are stubs (console warning only)—do not expect live updates.

---

## 7. Disconnect account — publish fails gracefully

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Connect Etsy; confirm publish works once | Baseline |
| 7.2 | Disconnect Etsy (Settings → Revoke) | Connection removed |
| 7.3 | Attempt publish to Etsy | Fails with clear message (not unhandled 500) |
| 7.4 | Mobile Connections shows disconnected | User can reconnect |

- [ ] Pass / Fail: _______

---

## 8. Mobile deep-link OAuth callback

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Cold start app → Connections → Connect Etsy | Browser opens |
| 8.2 | Complete OAuth | App foregrounds via `kauf26://oauth/etsy?connected=1` |
| 8.3 | Cancel OAuth in browser | App shows cancellation; no crash |
| 8.4 | Background app during OAuth (iOS) | Resume or retry works |
| 8.5 | Android back button during OAuth | Clean cancel or complete |

- [ ] Pass / Fail: _______

---

## 9. Legal links (mobile Settings)

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Settings tab → **Privacy Policy** | Opens `EXPO_PUBLIC_WEB_BASE_URL/privacy` in browser |
| 9.2 | **Terms of Service** | Opens `/terms` |
| 9.3 | Production build without legal env | Build fails validation (`validate-production-env.js`) |

- [ ] Pass / Fail: _______

---

## 10. Production config smoke

| Step | Action | Expected |
|------|--------|----------|
| 10.1 | `EXPO_PUBLIC_API_URL` unset → `npm run build:ios` | Fails fast with clear error |
| 10.2 | Legal URLs unset → production validation | Fails fast |
| 10.3 | Valid env → `validate:production-env` | Exit 0 |

- [ ] Pass / Fail: _______

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | |
| Dev | | | |

**Blockers for store submit:** Any failed test in sections 1, 5, 8, or 9 for your launch marketplaces (minimum: Etsy connect + publish + mobile OAuth).

---

## Related

- `docs/qa/mobile-oauth-test-plan.md` — extended mobile OAuth scenarios
- `DEPLOY_BACKEND.md` — server deploy & redirect URIs
- `mobile/MOBILE_SUBMISSION.md` — EAS build steps
