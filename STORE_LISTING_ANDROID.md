# Google Play — Listing Copy & Assets (Android)

Draft store listing for **Kauf26** (package: `com.globalmarketplacelister.app`). Production builds use **AAB** (`eas.json` → `"buildType": "aab"`).

---

## ⚠️ Important: Marketplace claims

**Do not claim “26 marketplaces” in the short or full description.**

Advertise only **tested, live** integrations:

- **Etsy, eBay, Shopify** — OAuth connect + publish
- **Amazon** — connect (publish may be limited; do not over-promise)
- **Allegro** — optional if tested in your region

Avoid: “List on every marketplace”, “26 platforms”, “TikTok/Depop/Vinted” unless implemented.

---

## App name (30 characters)

`Kauf26`

---

## Short description (80 characters)

`AI product photos & listings for Etsy, eBay, and Shopify sellers.`

---

## Full description (4000 characters)

```
Kauf26 helps resellers list inventory faster on major marketplaces.

HOW IT WORKS
1. Take or import product photos
2. AI identifies the item and suggests title, description, and price
3. Connect Etsy, eBay, or Shopify via secure OAuth
4. Publish listing drafts from your phone

SUPPORTED MARKETPLACES
This version supports OAuth and publishing for Etsy, eBay, and Shopify. Connect Amazon in Settings for future seller tools. See the Connections screen for platforms available on your account.

FEATURES
• Camera and gallery import for listing images
• AI-powered identification and pricing research
• Encrypted OAuth tokens stored on our server (HTTPS)
• Inventory quantity sync for Etsy (when configured)
• Privacy Policy and Terms accessible in Settings

NOT INCLUDED
This app does not replace each marketplace’s official seller app for orders, shipping labels, or disputes. It focuses on creating and publishing listings.

Privacy Policy: https://yourdomain.com/privacy
Terms: https://yourdomain.com/terms
Contact: support@yourdomain.com
```

---

## Graphics

| Asset | Spec |
|-------|------|
| App icon | 512 × 512 PNG (32-bit, no alpha for Play) |
| Feature graphic | 1024 × 500 PNG/JPG |
| Phone screenshots | Min 2, max 8; 16:9 or 9:16; min 320px short side |
| 7" tablet | Optional |
| 10" tablet | Optional |

Screenshot order (same as iOS): capture → identify → draft → Connections → publish success.

---

## Category

**Business** (primary) or **Shopping** (secondary)

---

## Content rating

Complete Google Play questionnaire (IARC). Typical result: Everyone or Teen depending on user-generated listing content answers.

---

## Data safety form mapping

Map Play Console **Data safety** to actual app behavior and `PrivacyInfo.xcprivacy`:

| Data type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| Photos and videos | Yes | No* | App functionality | No (core feature) |
| User IDs / account info | Yes | No* | App functionality, account management | No |
| App activity (in-app actions) | Optional | No | Analytics if added later | — |

\*OAuth tokens and photos are sent to **your backend** (`EXPO_PUBLIC_API_URL`) for marketplace API calls — declare “data is encrypted in transit”; do not mark as “sold to third parties” unless applicable.

| Question | Answer |
|----------|--------|
| Data encrypted in transit | Yes (HTTPS) |
| Users can request deletion | Yes (support email / account settings) |
| Committed to Play Families Policy | If targeting children: No (business app) |
| Advertising ID | No |
| Tracking across apps | No |

**Third-party SDKs:** Expo, React Native — no ad SDKs. List Expo modules that access camera, storage, network.

---

## Privacy Policy URL

**Required:** `https://yourdomain.com/privacy`

Must match `EXPO_PUBLIC_WEB_BASE_URL` / in-app Settings links.

---

## Target audience

- Not designed primarily for children under 13
- Business / reseller audience

---

## Release checklist

- [ ] Upload **AAB** from EAS production profile
- [ ] Data safety form submitted and matches Privacy Policy
- [ ] Short/full description limited to Etsy, eBay, Shopify (+ optional Allegro)
- [ ] Feature graphic and 512 icon uploaded
- [ ] Internal testing track → closed test → production rollout
- [ ] `EXPO_PUBLIC_API_URL` and legal URLs set in EAS secrets before build

---

## OAuth / deep links

Intent filter for `kauf26://oauth/*` is in `app.json`. No Play Console special config required beyond verifying App Links if you add HTTPS universal links later.

---

## Related

- `STORE_LISTING_IOS.md` — parallel iOS copy
- `mobile/MOBILE_SUBMISSION.md` — EAS build & submit
- `MANUAL_QA.md` — pre-release testing
