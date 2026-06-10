# Global Marketplace Lister - Mobile App

A React Native mobile app for listing products across multiple marketplaces.

## Features

- 4-digit PIN authentication
- Camera/photo upload for products
- AI-powered product description generation (with exact match detection)
- List to 13 marketplaces organized by Local & Global
- New/Used condition toggle
- Sales tracking with automatic 2% fee deduction
- Currency converter
- Shipping label generator with estimated costs

## Supported Platforms

This app works on **both iOS and Android**. Follow the instructions below for your target platform.

---

## Marketplace OAuth (one-tap connect)

Etsy, Shopify, and eBay connect via one-tap OAuth in the **Connections** tab. Tokens stay on-device only.

**Redirect URI setup:** see [docs/mobile-oauth-redirect-setup.md](../docs/mobile-oauth-redirect-setup.md) for developer-console checklists and iOS/Android deep-link configuration.

**Important:** OAuth requires a development or production build with the `kauf26` URL scheme. Expo Go uses `exp://` and cannot receive `kauf26://oauth/...` callbacks.

---

# APPLE iOS - App Store Submission Guide

## Step 1: Prerequisites (One-Time Setup)

1. **Get an Apple Developer Account**
   - Go to https://developer.apple.com/programs/
   - Click "Enroll"
   - Sign in with your Apple ID (or create one)
   - Pay the $99/year fee
   - Wait for approval (usually 24-48 hours)

2. **Install Required Software on Your Computer**
   ```bash
   # Install Node.js from https://nodejs.org (version 18 or higher)
   
   # Install Expo CLI
   npm install -g @expo/cli
   
   # Install EAS CLI (for building)
   npm install -g eas-cli
   ```

3. **Create an Expo Account**
   - Go to https://expo.dev
   - Click "Sign Up"
   - Verify your email

## Step 2: Download Your App Code

1. **Download the mobile folder from Replit**
   - In Replit, click the three dots menu on the `mobile` folder
   - Select "Download as ZIP"
   - Extract the ZIP file on your computer

2. **Open Terminal/Command Prompt**
   - Navigate to the extracted mobile folder:
   ```bash
   cd path/to/mobile
   ```

## Step 3: Configure Your App

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Update the API URL** (CRITICAL!)
   - Open `src/services/api.ts`
   - Replace the URL with your published Replit app URL:
   ```typescript
   export const API_BASE_URL = 'https://YOUR-APP-NAME.replit.app';
   ```
   - Save the file

3. **Update app.json with your info**
   - Open `app.json`
   - Change these fields:
   ```json
   {
     "expo": {
       "name": "Your App Name",
       "slug": "your-app-name",
       "ios": {
         "bundleIdentifier": "com.yourcompany.yourappname"
       },
       "android": {
         "package": "com.yourcompany.yourappname"
       }
     }
   }
   ```

## Step 4: Create App Icons and Screenshots

1. **App Icon** (Required)
   - Create a 1024x1024 PNG image
   - Save it as `assets/icon.png`
   - No transparency, no rounded corners (Apple adds them)

2. **Splash Screen**
   - Create a 1284x2778 PNG image
   - Save it as `assets/splash.png`

3. **App Store Screenshots** (Required)
   - You'll need screenshots for these sizes:
     - 6.7" iPhone (1290 x 2796)
     - 6.5" iPhone (1284 x 2778)
     - 5.5" iPhone (1242 x 2208)
   - Take at least 3 screenshots showing key features

## Step 5: Build Your iOS App

1. **Login to EAS**
   ```bash
   eas login
   ```
   - Enter your Expo account email and password

2. **Configure the build**
   ```bash
   eas build:configure
   ```
   - Select "All" or "iOS" when prompted

3. **Start the iOS build**
   ```bash
   eas build --platform ios
   ```
   - When asked for Apple credentials, enter:
     - Your Apple ID (developer account email)
     - App-specific password (create at appleid.apple.com under Security > App-Specific Passwords)
   - Wait for the build (usually 15-30 minutes)
   - You'll receive a link when complete

## Step 6: Create Your App in App Store Connect

1. **Go to App Store Connect**
   - Visit https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Create a New App**
   - Click "My Apps" > "+" > "New App"
   - Fill in:
     - Platform: iOS
     - Name: Your app name
     - Primary Language: English
     - Bundle ID: Select the one you configured
     - SKU: Any unique identifier (e.g., "marketplace-lister-001")
   - Click "Create"

3. **Fill in App Information**
   - **App Information Tab:**
     - Privacy Policy URL (required - you can use a free generator)
     - Category: Shopping
   
   - **Pricing and Availability Tab:**
     - Set your price (or Free)
     - Select countries
   
   - **App Privacy Tab:**
     - Answer the data collection questions
   
   - **Version Information:**
     - Description (up to 4000 characters)
     - Keywords (up to 100 characters, comma-separated)
     - Support URL
     - Marketing URL (optional)
     - Screenshots (upload for each device size)

## Step 7: Submit Your iOS App

1. **Submit the build to App Store**
   ```bash
   eas submit --platform ios
   ```
   - Follow the prompts
   - Select the build you created
   - It will upload to App Store Connect

2. **In App Store Connect**
   - Go to your app
   - Under "Build", click "+" and select your uploaded build
   - Click "Submit for Review"

3. **Wait for Review**
   - Apple typically reviews apps within 24-48 hours
   - You'll receive email notifications about status

---

# ANDROID - Google Play Store Submission Guide

## Step 1: Prerequisites (One-Time Setup)

1. **Get a Google Play Developer Account**
   - Go to https://play.google.com/console/signup
   - Sign in with your Google account
   - Pay the one-time $25 fee
   - Complete the account setup (verification may take a few days)

2. **Install Required Software** (same as iOS)
   ```bash
   # Install Node.js from https://nodejs.org (version 18 or higher)
   
   # Install Expo CLI
   npm install -g @expo/cli
   
   # Install EAS CLI (for building)
   npm install -g eas-cli
   ```

3. **Create an Expo Account** (if you haven't already)
   - Go to https://expo.dev
   - Click "Sign Up"
   - Verify your email

## Step 2: Download and Configure (Same as iOS)

Follow Steps 2 and 3 from the iOS section above.

Make sure `app.json` has the Android package name:
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourappname"
    }
  }
}
```

## Step 3: Create Android App Icons

1. **App Icon** (Required)
   - Same 1024x1024 PNG as iOS works for Android
   - Save it as `assets/icon.png`

2. **Adaptive Icon** (Recommended for Android)
   - Create a 1024x1024 foreground image (main icon, can have transparency)
   - Create a 1024x1024 background image (solid color or pattern)
   - Add to `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "adaptiveIcon": {
           "foregroundImage": "./assets/adaptive-icon.png",
           "backgroundColor": "#FFFFFF"
         }
       }
     }
   }
   ```

3. **Google Play Screenshots** (Required)
   - You'll need screenshots for:
     - Phone: At least 2 screenshots (1080 x 1920 or similar)
     - Tablet: Optional but recommended (1200 x 1920)
   - Take screenshots showing key features

## Step 4: Build Your Android App

1. **Login to EAS** (if not already logged in)
   ```bash
   eas login
   ```

2. **Build for Android**
   ```bash
   eas build --platform android
   ```
   - No special credentials needed (EAS handles signing)
   - Wait for the build (usually 10-20 minutes)
   - You'll receive a download link for the .aab file

3. **Download the .aab file**
   - Click the link in your terminal or find it at https://expo.dev
   - This is the file you'll upload to Google Play

## Step 5: Create Your App in Google Play Console

1. **Go to Google Play Console**
   - Visit https://play.google.com/console
   - Sign in with your developer account

2. **Create a New App**
   - Click "Create app"
   - Fill in:
     - App name: Your app name
     - Default language: English (United States)
     - App or game: App
     - Free or paid: Choose your model
   - Accept the declarations
   - Click "Create app"

3. **Set Up Your Store Listing**
   - Go to "Main store listing" in the left menu
   - Fill in:
     - **Short description** (up to 80 characters)
     - **Full description** (up to 4000 characters)
     - **App icon**: 512x512 PNG
     - **Feature graphic**: 1024x500 PNG (banner image)
     - **Screenshots**: Upload for phone (and tablet if available)
     - **App category**: Shopping
   - Click "Save"

4. **Complete App Content Section**
   - Go to "App content" in the left menu
   - Complete ALL required items:
     - **Privacy policy**: Add your privacy policy URL
     - **Ads**: Declare if your app shows ads
     - **App access**: Describe how to access all features
     - **Content ratings**: Complete the questionnaire
     - **Target audience**: Select age groups
     - **News apps**: Usually "No"
     - **COVID-19 apps**: Usually "No"
     - **Data safety**: Describe what data you collect

## Step 6: Upload and Submit Your Android App

1. **Submit the build to Google Play**
   ```bash
   eas submit --platform android
   ```
   - Follow the prompts
   - You'll need a Google Play Service Account key (EAS can guide you through creating one)
   
   **OR manually upload:**
   - Go to Google Play Console
   - Select your app
   - Go to "Release" > "Production"
   - Click "Create new release"
   - Upload your .aab file
   - Add release notes
   - Click "Review release"

2. **Review and Publish**
   - Review all the information
   - Click "Start rollout to Production"
   - Confirm

3. **Wait for Review**
   - Google typically reviews apps within 1-7 days (first submission takes longer)
   - You'll receive email notifications about status

---

# Troubleshooting

## iOS Issues

**"Bundle identifier already exists"**
- Change the bundleIdentifier in app.json to something unique

**"Missing compliance information"**
- Go to App Store Connect > Your App > Builds
- Click the warning icon next to your build
- Answer the export compliance question (usually "No" for most apps)

**"App was rejected"**
- Read the rejection reason carefully
- Make the required changes
- Resubmit

**Build fails with signing error**
- Run `eas credentials` to manage your certificates
- Select "iOS" > "Build Credentials" > "Set up a new one"

## Android Issues

**"Package name already exists"**
- Change the package name in app.json to something unique

**"App not available in your country"**
- Check your app's availability settings in Google Play Console

**"Target SDK is too low"**
- Update to the latest Expo SDK version
- Run `npx expo upgrade`

**Build fails**
- Check your internet connection
- Try running `eas build --platform android --clear-cache`

---

# Quick Reference Commands

```bash
# Login to Expo
eas login

# Configure build (first time only)
eas build:configure

# Build for iOS (App Store)
eas build --platform ios

# Build for Android (Google Play)
eas build --platform android

# Build for both platforms
eas build --platform all

# Submit to App Store (iOS)
eas submit --platform ios

# Submit to Google Play (Android)
eas submit --platform android

# Check build status
eas build:list

# View/manage credentials
eas credentials

# Test on device with Expo Go
npx expo start
```

---

# Project Structure

```
mobile/
├── App.tsx                 # Main app entry with PIN auth
├── app.json                # Expo configuration
├── eas.json                # EAS Build configuration
├── src/
│   ├── navigation/
│   │   └── MainNavigator.tsx    # Bottom tab navigation
│   ├── screens/
│   │   ├── PinAuthScreen.tsx    # 4-digit PIN authentication
│   │   ├── HomeScreen.tsx       # Product upload & AI analysis
│   │   ├── ListingsScreen.tsx   # Manage marketplace listings
│   │   ├── SalesScreen.tsx      # Sales & fee tracking
│   │   └── ToolsScreen.tsx      # Currency converter & shipping
│   └── services/
│       └── api.ts               # API client configuration
└── assets/                      # App icons and splash screen
```

---

# Supported Marketplaces

**Local (US-focused):**
- eBay
- Amazon
- Walmart
- Wish
- Reverb

**Global (International):**
- Etsy
- Shopify
- WooCommerce
- AliExpress
- Mercado Libre
- Rakuten
- BigCommerce
- PrestaShop

---

# Cost Summary

| Platform | Developer Fee | Review Time |
|----------|---------------|-------------|
| Apple App Store | $99/year | 24-48 hours |
| Google Play Store | $25 one-time | 1-7 days |

---

# Support

Your mobile app connects to the Replit backend. Make sure:
1. Your web app is published on Replit
2. The API_BASE_URL is correctly set in the mobile app
3. Your Replit app stays running (consider upgrading for always-on hosting)
