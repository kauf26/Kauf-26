# Kauf26 — App Privacy Questionnaire Answers

Copy-paste reference for App Store Connect → App Privacy. Last updated: July 4, 2026.

**Privacy Policy URL:** https://kauf-26.onrender.com/api/privacy

---

## Section 1: Data Collection

**Do you or your third-party partners collect data from this app?**

```
Yes
```

---

## Section 2: Tracking

**Do you or your third-party partners use data from this app to track users?**

```
No
```

**Explanation (if prompted):**

```
Kauf26 does not track users across apps or websites owned by other companies. NSPrivacyTracking is false in our Privacy Manifest. We do not use IDFA, SKAdNetwork for attribution, or third-party advertising SDKs.
```

---

## Section 3: Data Types Collected

For each data type below, select **Yes**, then configure as indicated.

### Contact Info → Email Address

| Question | Answer |
|----------|--------|
| Collected? | Yes |
| Linked to user? | Yes |
| Used for tracking? | No |
| Purposes | App Functionality |

```
Collected via Sign in with Apple, Google Sign-In, or account registration. Used for authentication, account management, and service communications.
```

### Contact Info → Name

| Question | Answer |
|----------|--------|
| Collected? | Yes |
| Linked to user? | Yes |
| Used for tracking? | No |
| Purposes | App Functionality |

```
Collected from Apple/Google OAuth profile (first name, last name). Used to personalize the account and display in profile settings.
```

### User Content → Photos or Videos

| Question | Answer |
|----------|--------|
| Collected? | Yes |
| Linked to user? | No |
| Used for tracking? | No |
| Purposes | App Functionality |

```
Product photos captured via camera or selected from photo library. Transmitted to our server and OpenAI API for AI identification and listing generation. Not used for advertising or profiling.
```

### Identifiers → User ID

| Question | Answer |
|----------|--------|
| Collected? | Yes |
| Linked to user? | Yes |
| Used for tracking? | No |
| Purposes | App Functionality |

```
Internal account identifier assigned at registration. Used for authentication, session management, and syncing listing drafts.
```

### Usage Data → Product Interaction

| Question | Answer |
|----------|--------|
| Collected? | Yes |
| Linked to user? | Yes |
| Used for tracking? | No |
| Purposes | App Functionality |

```
Includes trial status, feature usage (e.g., identify requests, listing drafts created), and in-app interactions needed to operate the service and enforce usage limits.
```

---

## Section 4: Data NOT Collected

Confirm **No** for all of the following (unless your deployment differs):

| Data Type | Answer |
|-----------|--------|
| Health & Fitness | No |
| Financial Info (in-app) | No — Stripe handles payments on web; no card numbers stored in app |
| Location (Precise) | No |
| Location (Coarse) | No |
| Sensitive Info | No |
| Contacts | No |
| Browsing History | No |
| Search History | No |
| Purchases (Apple IAP) | No — unless IAP added later |
| Advertising Data | No |
| Crash Data | No — unless crash reporting SDK added |
| Performance Data | No — unless analytics SDK added |
| Other Data | No |

---

## Section 5: Third-Party Data Sharing

**Is data shared with third parties?**

```
Yes — for app functionality only (not for tracking or advertising)
```

### OpenAI

| Field | Value |
|-------|-------|
| Data shared | Product photos (images) |
| Purpose | AI identification and listing text generation |
| Linked to user | No (images processed per request) |
| Tracking | No |

```
Product images are sent to OpenAI's API (GPT-4o) when the user taps Identify or generates a listing. Governed by OpenAI's API data policies.
```

### Apple

| Field | Value |
|-------|-------|
| Data shared | Authentication tokens, email, name (if user consents via Sign in with Apple) |
| Purpose | Authentication |
| Linked to user | Yes |
| Tracking | No |

### Google

| Field | Value |
|-------|-------|
| Data shared | Authentication tokens, email, name (if user chooses Google Sign-In) |
| Purpose | Authentication |
| Linked to user | Yes |
| Tracking | No |

### Stripe

| Field | Value |
|-------|-------|
| Data shared | Email, payment metadata (web/server-side billing) |
| Purpose | Payment processing for service fees |
| Linked to user | Yes |
| Tracking | No |

```
Payment card data is handled entirely by Stripe. Kauf26 does not store card numbers.
```

### Marketplace Platforms (eBay, Etsy, Shopify, etc.)

| Field | Value |
|-------|-------|
| Data shared | Listing data, OAuth tokens (stored on-device in Keychain) |
| Purpose | Publishing listings to connected marketplaces |
| Linked to user | Yes |
| Tracking | No |

```
OAuth tokens are stored in iOS Keychain on the user's device. Listing content is sent to marketplaces only when the user explicitly publishes.
```

---

## Section 6: Privacy Manifest (PrivacyInfo.xcprivacy)

| Declaration | Value |
|-------------|-------|
| NSPrivacyTracking | false |
| Collected: Email | App Functionality, Linked, Not Tracking |
| Collected: Name | App Functionality, Linked, Not Tracking |
| Collected: Photos | App Functionality, Not Linked, Not Tracking |
| Collected: User ID | App Functionality, Linked, Not Tracking |
| Collected: Product Interaction | App Functionality, Linked, Not Tracking |
| API: UserDefaults | CA92.1 |
| API: File Timestamp | C617.1 |

---

## Section 7: Privacy Policy URL

```
https://kauf-26.onrender.com/api/privacy
```

---

## Section 8: Quick Copy — Full Summary for Review Notes

```
DATA COLLECTED: Email, Name, Photos, User ID, Product Interaction.
TRACKING: None. NSPrivacyTracking = false.
THIRD PARTIES: OpenAI (image AI), Apple (Sign in), Google (Sign in), Stripe (payments), marketplaces (publish only).
PURPOSE: App functionality only — authentication, AI listing generation, marketplace publishing.
PRIVACY POLICY: https://kauf-26.onrender.com/api/privacy
TERMS: https://kauf-26.onrender.com/api/terms
```

---

## Section 9: Demo Account (Development Only)

```
The demo account (demo@kauf26.com) is enabled only when NODE_ENV !== production.
It is NOT available on the production server at https://kauf-26.onrender.com.
Apple reviewers should use Sign in with Apple on the production build.
```
