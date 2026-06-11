# Kauf26 monorepo structure

This repository is an **npm workspaces** monorepo. One install at the repo root links web, server, mobile, and shared code.

## Packages

| Path | npm name | Role |
|------|----------|------|
| `/` (root) | `kauf26` | Web app (Vite + React), Express API (`server/`), scripts, Drizzle CLI |
| `shared/` | `@kauf26/shared` | Drizzle schema, identify flow, marketplace helpers, shared tests |
| `mobile/` | `global-marketplace-lister` | Expo React Native app |

There is no separate `server/` package — the API lives in `server/` at the repo root and runs via `npm run server`.

## Directory map

```text
Kauf26_Local/
├── src/              Web UI (pages, components, hooks)
├── server/           Express API, scrapers, marketplace adapters
├── shared/           Cross-platform TypeScript (schema + business logic)
├── mobile/           Expo app (screens, navigation, native services)
├── migrations/       Drizzle SQL migrations (from shared/schema.ts)
├── scripts/          Deploy, QA, CLI tools
├── public/           Web static assets
└── docs/             Architecture and roadmap
```

## Import conventions

| Consumer | Shared code | Example |
|----------|-------------|---------|
| Web (`src/`) | `@shared/*` alias | `import { identifyFlow } from '@shared/identifyFlow'` |
| Server (`server/`) | Relative `../shared/` or `@shared/*` | `import { productDrafts } from '../shared/schema'` |
| Mobile (`mobile/`) | Relative `../../../shared/` | Metro watches repo root via `mobile/metro.config.js` |

## Install & run

```bash
# From repo root — installs root + mobile + shared workspaces
npm install
cp .env.example .env

npm run server          # API (default :2626)
npm run dev             # Web (:5173)
npm run mobile:start    # Expo Metro
npm run dev:all         # Server + mobile + web together
```

Mobile-only commands from root:

```bash
npm run mobile:ios
npm run mobile:android
```

## Schema source of truth

- **Edit:** `shared/schema.ts`
- **Config:** `drizzle.config.ts` → `./shared/schema.ts`
- **Legacy (do not edit):** `server/db/` — see `server/db/README.md`

## Removed / avoid

- `client/replit_integrations/` — deleted; was unused Replit audio helpers
- `src/server/* 2.ts` — deleted; duplicate copies of server routes
- Root `expo` dependency — removed; Expo belongs only in `mobile/package.json`

## Adding shared code

1. Add a `.ts` file under `shared/`
2. Import from web via `@shared/yourModule`
3. Import from mobile via relative path (or add a Metro alias later)
4. Import from server via `../shared/yourModule` or `@shared/yourModule`

Optional: add tests next to the module (`yourModule.test.ts`) and run `npm test` from root.
