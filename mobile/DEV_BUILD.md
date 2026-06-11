# Development build on your personal phone

Expo Go cannot run this app (custom native modules: camera, biometrics, secure store). Use a **development build** with `expo-dev-client`.

## Prerequisites

- Mac with Xcode (iOS) or Android Studio (Android)
- iPhone/iPad connected via USB **or** on the same Wi‑Fi as your Mac
- Apple ID added in Xcode → Settings → Accounts (free account works for 7‑day installs)
- Node.js and `npm install` already done in `mobile/`

## 1. Configure API URL for a physical device

The phone cannot reach `localhost`. Use your Mac’s LAN IP:

```bash
# Find your Mac IP (example output: 192.168.1.42)
ipconfig getifaddr en0
```

Create or edit `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:2626
EXPO_PUBLIC_WEB_BASE_URL=http://192.168.1.42:5173
```

Start the backend on your Mac (same machine):

```bash
cd .. && npm run server   # port 2626
```

## 2. Install dependencies (once)

```bash
cd mobile
npm install
npx expo install expo-dev-client
```

## 3. Build and install on iPhone (recommended)

```bash
cd mobile
npx expo run:ios --device
```

- Pick your phone from the list when prompted.
- First build takes several minutes (CocoaPods + Xcode).
- Trust the developer certificate on the phone: **Settings → General → VPN & Device Management**.

## 3b. Android

Enable **Developer options** and **USB debugging**, connect the phone, then:

```bash
cd mobile
npx expo run:android --device
```

## 4. Start Metro (every dev session)

In a **separate terminal**:

```bash
cd mobile
npm run start:dev
```

Open the **Kauf26** app on your phone (not Expo Go). It connects to Metro on your LAN IP.

If the app shows “Could not connect to development server”, shake the device → **Configure bundler** → enter `http://YOUR_MAC_IP:8081`.

## 5. Test the camera

1. Complete PIN / Face ID onboarding.
2. **Home** tab → **Start Camera**.
3. Allow **Camera** when iOS prompts.
4. Wait for “Starting camera…” to finish, then tap the green shutter button.
5. Photo appears in the review grid → **Identify**.

If capture fails:

- **Settings → Kauf26 → Camera** → Allow
- Rebuild after native changes: `npx expo run:ios --device`

## 6. EAS cloud development build (optional)

If you prefer not to use Xcode locally:

```bash
cd mobile
eas build --profile development --platform ios
```

Install the `.ipa` via the link EAS provides, then run `npm run start:dev`.

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run dev:ios` | Build + install on connected iPhone |
| `npm run dev:android` | Build + install on connected Android |
| `npm run start:dev` | Metro for dev client |
| `npm run server` (repo root) | API on :2626 |
