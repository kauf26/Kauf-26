# Global Marketplace Lister - Mobile App

A React Native mobile app for listing products across multiple marketplaces.

## Features

- 4-digit PIN authentication
- Camera/photo upload for products
- AI-powered product description generation (with exact match detection)
- List to 11 marketplaces organized by Local & Global
- New/Used condition toggle
- Sales tracking with automatic 2% fee deduction
- Currency converter
- Shipping label generator with estimated costs

## Complete Step-by-Step Guide to App Store Submission

### Step 1: Prerequisites (One-Time Setup)

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

### Step 2: Download Your App Code

1. **Download the mobile folder from Replit**
   - In Replit, click the three dots menu on the `mobile` folder
   - Select "Download as ZIP"
   - Extract the ZIP file on your computer

2. **Open Terminal/Command Prompt**
   - Navigate to the extracted mobile folder:
   ```bash
   cd path/to/mobile
   ```

### Step 3: Configure Your App

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
       }
     }
   }
   ```

### Step 4: Create App Icons and Screenshots

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

### Step 5: Build Your App

1. **Login to EAS**
   ```bash
   eas login
   ```
   - Enter your Expo account email and password

2. **Configure the build**
   ```bash
   eas build:configure
   ```
   - Select "iOS" when prompted

3. **Start the iOS build**
   ```bash
   eas build --platform ios
   ```
   - When asked for Apple credentials, enter:
     - Your Apple ID (developer account email)
     - App-specific password (create at appleid.apple.com under Security > App-Specific Passwords)
   - Wait for the build (usually 15-30 minutes)
   - You'll receive a link when complete

### Step 6: Create Your App in App Store Connect

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

### Step 7: Submit Your App

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

### Troubleshooting Common Issues

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

### Quick Reference Commands

```bash
# Login to Expo
eas login

# Build for iOS (App Store)
eas build --platform ios --profile production

# Build for testing (TestFlight)
eas build --platform ios --profile preview

# Submit to App Store
eas submit --platform ios

# Check build status
eas build:list

# View/manage credentials
eas credentials
```

### Project Structure

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

### Supported Marketplaces

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

### Support

Your mobile app connects to the Replit backend. Make sure:
1. Your web app is published on Replit
2. The API_BASE_URL is correctly set in the mobile app
3. Your Replit app stays running (consider upgrading for always-on hosting)
