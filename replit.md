# Global Marketplace Lister

## Overview

Global Marketplace Lister is an AI-powered multi-marketplace product listing platform. Users can upload product photos, generate AI descriptions, and create listings across multiple e-commerce platforms including eBay, Amazon, Etsy, Shopify, WooCommerce, Mercado Libre, and Rakuten. The platform handles automatic currency conversion and language translation for international marketplaces.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite for development and production builds

The frontend follows a pages-based structure with components organized in `client/src/pages/` for main views (home, listings, sales, tools) and reusable UI components in `client/src/components/ui/`.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Uploads**: Multer for handling image uploads
- **AI Integration**: OpenAI API for product analysis and description generation

The server uses a clean separation between routes (`server/routes.ts`), database access (`server/db.ts`), and storage layer (`server/storage.ts`). The storage layer implements an interface pattern for database operations.

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Core Tables**:
  - `users` - User authentication
  - `products` - Uploaded products with AI-generated descriptions
  - `listings` - Marketplace-specific listings with translations
  - `sales` - Transaction records with fee tracking
  - `conversations/messages` - Chat functionality for AI integrations

### AI Integrations
The application includes pre-built AI integration modules in `server/replit_integrations/`:
- **Audio**: Voice chat with speech-to-text and text-to-speech
- **Image**: Image generation and editing via OpenAI
- **Chat**: Conversation management with streaming responses
- **Batch**: Rate-limited batch processing utilities

### Build System
- **Client Build**: Vite compiles React to `dist/public`
- **Server Build**: esbuild bundles server code to `dist/index.cjs`
- **Development**: Uses tsx for TypeScript execution, Vite dev server with HMR

## External Dependencies

### AI Services
- **OpenAI API**: Used for product image analysis, description generation, and text translation
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Primary database
- Environment variable: `DATABASE_URL`

### Supported Marketplaces
The platform supports listing to 13 marketplaces:
- Local: eBay, Amazon, Walmart, Wish, Reverb (English/USD)
- Global: Etsy, Shopify, WooCommerce, AliExpress, BigCommerce (English/USD)
- Mercado Libre (Spanish/MXN)
- Rakuten (Japanese/JPY)
- PrestaShop (English/EUR)

### Currency Support
Built-in conversion rates for: USD, EUR, GBP, JPY, MXN, BRL, AUD, CAD

## Authentication

The app uses Replit Auth (OpenID Connect) for user sign-in. Users can sign in with:
- **Google** account
- **Apple** account
- **GitHub** account
- **Email & password**

### Auth Architecture
- `server/replit_integrations/auth/replitAuth.ts` — Passport.js OIDC strategy setup, `/api/login`, `/api/callback`, `/api/logout` routes
- `server/replit_integrations/auth/storage.ts` — Upserts users from OAuth claims into the `users` table
- `server/replit_integrations/auth/routes.ts` — `/api/auth/user` endpoint (protected)
- `client/src/hooks/use-auth.ts` — React hook for auth state
- Sessions stored in `sessions` table via connect-pg-simple
- Environment vars required: `REPL_ID`, `REPLIT_DOMAINS`, `SESSION_SECRET` (all provided by Replit automatically)

### Users Table (updated for OAuth)
The `users` table now stores OAuth profile data (`email`, `first_name`, `last_name`, `profile_image_url`) instead of username/password. Old PIN-based auth has been removed.

### Protected Routes
All app routes redirect to `/login` if the user is not authenticated. Public routes: `/login`, `/privacy`, `/terms`, `/submit`.

## Mobile App (React Native/Expo)

A native iOS mobile app version has been created in the `mobile/` directory.

### Mobile Architecture
- **Framework**: React Native with Expo
- **Navigation**: React Navigation (bottom tabs)
- **Authentication**: 4-digit PIN stored in Expo SecureStore
- **Image Handling**: expo-image-picker and expo-camera

### Mobile Screens
- `PinAuthScreen`: 4-digit PIN creation and authentication
- `HomeScreen`: Camera/photo upload with AI product analysis
- `ListingsScreen`: View and manage marketplace listings
- `SalesScreen`: Sales tracking with 2% fee display
- `ToolsScreen`: Currency converter and shipping label generator

### Building for App Store
1. Create an Apple Developer account ($99/year)
2. Install EAS CLI: `npm install -g eas-cli`
3. Configure: `eas build:configure`
4. Build: `npm run build:ios`
5. Submit: `eas submit --platform ios`

See `mobile/README.md` for detailed instructions.