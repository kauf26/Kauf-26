# Global Marketplace Lister - Mobile App

A React Native mobile app for listing products across multiple marketplaces.

## Features

- 4-digit PIN authentication
- Camera/photo upload for products
- AI-powered product description generation
- List to 10 marketplaces (eBay, Amazon, Etsy, Shopify, WooCommerce, Mercado Libre, Rakuten, Depop, Vinted, Grailed)
- Sales tracking with automatic 2% fee deduction
- Currency converter
- Shipping label generator

## Getting Started

### Prerequisites

1. Install Node.js 18+ 
2. Install Expo CLI: `npm install -g @expo/cli`
3. Install EAS CLI: `npm install -g eas-cli`
4. Create an Expo account at https://expo.dev
5. Apple Developer account ($99/year) for App Store submission

### Development Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on iOS Simulator (Mac only):
   - Press `i` in the terminal, or
   - Run `npm run ios`

5. Run on your device:
   - Install Expo Go app on your iPhone
   - Scan the QR code from the terminal

### Building for App Store

1. Login to EAS:
   ```bash
   eas login
   ```

2. Configure your project:
   ```bash
   eas build:configure
   ```

3. Update `eas.json` with your Apple credentials

4. Build for iOS:
   ```bash
   npm run build:ios
   ```

5. Submit to App Store:
   ```bash
   eas submit --platform ios
   ```

### API Configuration

Update `src/services/api.ts` with your production API URL before building:

```typescript
export const API_BASE_URL = 'https://your-app.replit.app';
```

## Project Structure

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

## App Store Requirements

Before submitting to the App Store, ensure you have:

1. **App Icon**: Replace `assets/icon.png` (1024x1024)
2. **Splash Screen**: Replace `assets/splash.png`
3. **Privacy Policy**: Required for all apps
4. **App Store Screenshots**: Required for listing
5. **App Description**: For the App Store listing

## Support

This app connects to your existing backend API. Ensure your web app is deployed and running before using the mobile app.
