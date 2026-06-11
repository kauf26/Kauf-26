# Install Kauf26 on your physical iPhone (development build)

Expo Go **cannot** run this app (camera, biometrics, secure store). Use a **development build** with `expo-dev-client`.

Two paths:

| Path | Best for |
|------|----------|
| **A — EAS cloud build** | No Xcode cable build; install via QR/link on phone |
| **B — Local Xcode build** | Mac + USB; fastest iteration when Xcode works |

---

## Before you start

### 1. API URL for a physical device

Your phone cannot reach `localhost`. Use your Mac’s LAN IP:

```bash
ipconfig getifaddr en0
# example: 192.168.1.186
```

Edit `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.186:2626
EXPO_PUBLIC_WEB_BASE_URL=http://192.168.1.186:5173
```

Start the backend on your Mac:

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local
npm run server
```

Phone and Mac must be on the **same Wi‑Fi**.

### 2. Install dependencies

```bash
cd mobile
npm install
npx expo install expo-dev-client
```

`expo-dev-client` is already in `package.json` — re-run the command above to verify the SDK 51–compatible version.

---

## Path A — EAS development build (recommended for your iPhone)

### Step 1 — Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

Or without global install:

```bash
npx eas-cli login
```

You need a free [Expo](https://expo.dev) account.

### Step 2 — Link project to Expo (first time only)

```bash
cd mobile
eas init
```

This adds `extra.eas.projectId` to your Expo config. Commit that change (no secrets).

If prompted, choose **Create a new project** or link an existing one.

### Step 3 — Configure EAS (first time only)

```bash
eas build:configure
```

Your repo already has `eas.json` with a `development` profile:

```json
"development": {
  "developmentClient": true,
  "distribution": "internal"
}
```

Running `build:configure` is safe — it won’t remove that profile.

### Step 4 — Start the iOS development build

```bash
cd mobile
eas build --platform ios --profile development
```

Or use the npm script:

```bash
npm run eas:build:dev:ios
```

**First build prompts:**

- **Apple account** — sign in with your Apple ID (free or paid developer account).
- **Distribution certificate / provisioning** — choose **Let EAS handle it** (recommended).
- **Register devices** — EAS may ask you to register your iPhone UDID for ad-hoc/internal installs.

Build runs in the cloud (~10–20 min). Watch progress at [expo.dev](https://expo.dev) → your project → Builds.

### Step 5 — Install on your iPhone

When the build finishes:

1. Open the build page (link in terminal or Expo dashboard).
2. On your iPhone, scan the **QR code** or open the **Install** link in **Safari**.
3. Tap **Install** when iOS prompts.

### Step 6 — Enable Developer Mode (iOS 16+)

If the app won’t open or install fails:

**Settings → Privacy & Security → Developer Mode → On**

Restart the phone when asked.

### Step 7 — Trust the developer certificate

**Settings → General → VPN & Device Management**

Tap your developer profile (Apple Development / your team name) → **Trust**.

---

## Path B — Local build (USB + Xcode)

```bash
cd mobile
npm run dev:ios
```

Pick your physical iPhone from the list. Then complete Steps 6–7 above if needed.

---

## Daily development (after the app is installed)

### Terminal 1 — API server

```bash
cd /Users/chriskaeufl/Desktop/Kauf26_Local
npm run server
```

### Terminal 2 — Metro (dev client)

```bash
cd mobile
npm run start:dev
```

Equivalent:

```bash
npx expo start --dev-client --clear
```

### Connect the app

1. Open **Kauf26** on your iPhone (not Expo Go).
2. The dev client should auto-connect to Metro on your LAN.
3. If not:
   - Scan the **QR code** shown in the terminal with the **Camera** app, or
   - Shake the phone → **Configure bundler** → enter `http://YOUR_MAC_IP:8081`

Example: `http://192.168.1.186:8081`

### Test the camera

1. Complete PIN / Face ID.
2. **Home** → **Start Camera** → allow Camera.
3. Wait for preview → tap green shutter → **Identify**.

---

## Troubleshooting

### Build errors

| Error | Fix |
|-------|-----|
| `Not logged in` | `eas login` |
| `No projectId` / project not configured | `cd mobile && eas init` |
| Apple credentials failed | `eas credentials` → reset iOS credentials, or choose “Let EAS manage” again |
| `bundle identifier` already in use | Change `ios.bundleIdentifier` in `app.json` or use your Apple team’s app |
| Build fails on `expo-dev-menu` / `TARGET_IPHONE_SIMULATOR` | Run `npm install` in `mobile/` (postinstall patch applies automatically) |
| `EXPO_PUBLIC_API_URL is required` | Only on **production** profile — use `--profile development` for dev builds |

### Install / open errors on iPhone

| Symptom | Fix |
|---------|-----|
| “Untrusted developer” | Settings → General → VPN & Device Management → Trust |
| App won’t install | Enable **Developer Mode** (Settings → Privacy & Security) |
| “Unable to install” | Device must be registered in Apple Developer / EAS device list — re-run build and register UDID when prompted |
| Build expired (7-day free cert) | Re-run `eas build --profile development` or `npm run dev:ios` |

### Metro / “Could not connect to development server”

| Symptom | Fix |
|---------|-----|
| Red error screen | Start Metro: `npm run start:dev` |
| Wrong bundler URL | Shake phone → Configure bundler → `http://MAC_IP:8081` |
| Firewall | Allow Node/Metro on Mac firewall; same Wi‑Fi for phone and Mac |
| API errors after connect | Change `EXPO_PUBLIC_API_URL` from `localhost` to `http://MAC_IP:2626` and restart Metro |

### Camera not capturing

- Settings → Kauf26 → Camera → Allow
- Rebuild dev client after native module changes: `eas build --profile development --platform ios` or `npm run dev:ios`

---

## Quick commands

| Command | Purpose |
|---------|---------|
| `npm run eas:build:dev:ios` | EAS cloud dev build for iPhone |
| `npm run dev:ios` | Local Xcode build + install (USB) |
| `npm run start:dev` | Metro for dev client |
| `eas build:list` | See past builds + install links |
| `eas device:create` | Register a new iPhone for internal installs |
