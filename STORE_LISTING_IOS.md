# App Store Connect — Listing Copy & Assets (iOS)

Use this as a draft for **Kauf26** (bundle ID: `com.kaufai.app`). Adjust tone to match your brand before submission.

---

## ⚠️ Important: Marketplace claims

**Do not claim “26 marketplaces” or “list everywhere” in the App Store listing.**

Only advertise platforms that are **live and tested** in your build:

| Status | Marketplaces |
|--------|----------------|
| **Live (OAuth + publish)** | Etsy, eBay, Shopify |
| **Connect only / partial** | Amazon (OAuth connect; SP-API publish may need additional setup) |
| **Optional mention** | Allegro (if configured and tested) |
| **Do not mention** | Partnership stubs, dry-run-only platforms |

Suggested subtitle: *“List on Etsy, eBay & Shopify with AI photos.”*

---

## App name

**Kauf26** — or your registered brand name (30 characters max for subtitle).

---

## Subtitle (30 characters)

`AI listings for Etsy, eBay, Shopify`

---

## Promotional text (170 characters, updatable without review)

`Snap product photos, get AI descriptions and prices, and publish drafts to Etsy, eBay, and Shopify from one app. Connect accounts securely via OAuth.`

---

## Description (4000 characters max)

```
Kauf26 helps resellers create marketplace listings faster.

Take photos of your inventory, identify products with AI, and generate titles, descriptions, and suggested prices. Connect your Etsy, eBay, and Shopify seller accounts with secure OAuth—your tokens stay encrypted on our server, not in the app binary.

WHAT YOU CAN DO
• Capture or import product photos
• AI-powered product identification and pricing hints
• Create listing drafts and publish to connected marketplaces
• Manage connected accounts (Etsy, eBay, Shopify, Amazon)
• Track inventory quantity sync on supported platforms

MARKETPLACES
This release supports OAuth connection and publishing for Etsy, eBay, and Shopify. Additional platforms may be added over time; see in-app Connections for what is available on your account.

PRIVACY & SECURITY
• Camera and photo library access are used only to create your listings
• OAuth tokens are sent to our server over HTTPS for marketplace API calls
• We do not sell your data or use it for cross-app tracking

Requires a Kauf26 account and an active internet connection. Some features require seller accounts on supported marketplaces.

Privacy Policy: https://yourdomain.com/privacy
Terms of Service: https://yourdomain.com/terms
Support: support@yourdomain.com
```

Replace `yourdomain.com` and support email before submission.

---

## Keywords (100 characters, comma-separated, no spaces after commas)

```
etsy,ebay,shopify,reseller,listing,inventory,marketplace,sell,thrift,depop alternative
```

Avoid misleading keywords (e.g. “amazon fba” if Amazon publish is not fully live).

---

## Category

- **Primary:** Business
- **Secondary:** Productivity or Shopping

---

## Age rating

Complete Apple’s questionnaire honestly. No unrestricted web access to adult content; user-generated listing content is seller-provided.

---

## Privacy Policy URL

**Required:** `https://yourdomain.com/privacy`

Must match in-app Settings link (`EXPO_PUBLIC_WEB_BASE_URL` + `/privacy`).

---

## App Privacy (Nutrition Labels)

Align with `mobile/ios/Kauf26/PrivacyInfo.xcprivacy`:

| Data type | Linked to user | Used for tracking | Purpose |
|-----------|----------------|-------------------|---------|
| Photos or videos | No | No | App functionality (listing photos) |
| User ID | Yes | No | App functionality (OAuth / account) |

**Tracking:** No  
**Third-party SDKs for tracking:** None beyond Expo runtime

---

## Screenshots (required sizes)

Capture from a **production or preview native build** — not Expo Go.

| Device | Size (pixels) | Count |
|--------|-----------------|-------|
| iPhone 6.7" | 1290 × 2796 | 3–10 |
| iPhone 6.5" | 1284 × 2778 | 3–10 |
| iPad Pro 12.9" | 2048 × 2732 | Optional if iPad supported |

### Suggested screenshot sequence

1. **Home / capture** — “Snap a product photo”
2. **AI identify result** — title, price suggestion
3. **Listing draft** — edit before publish
4. **Connections** — Etsy, eBay, Shopify connected
5. **Publish success** — confirmation with marketplace name
6. **Settings → Legal** — Privacy Policy link visible (optional)

Use real UI; blur sensitive account emails if needed.

---

## App Preview video (optional)

15–30 seconds: photo → identify → publish to Etsy. No false marketplace logos beyond what you support.

---

## Review notes for Apple

```
Test account: [email] / [password]
OAuth: Etsy/eBay/Shopify use Safari ASWebAuthenticationSession; callback scheme kauf26://oauth/
Backend: https://api.yourdomain.com
Demo Etsy shop: [if applicable]
Amazon connect is optional; primary flows are Etsy, eBay, Shopify.
```

Provide sandbox credentials if Apple requests live OAuth testing.

---

## Checklist before submit

- [ ] Privacy Policy URL live and matches app
- [ ] Terms URL live
- [ ] Description does not claim 26 marketplaces
- [ ] Screenshots from native build
- [ ] `PrivacyInfo.xcprivacy` included in IPA (verify via EAS build artifacts)
- [ ] Export compliance: `usesNonExemptEncryption: false` in app config (standard HTTPS only)
