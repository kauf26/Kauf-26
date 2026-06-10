#!/usr/bin/env bash
#
# Kauf26 production deployment helper.
# Does NOT deploy to a remote host — run on the server after configuring .env.
# Does NOT require EAS or marketplace developer accounts.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Kauf26 production deployment ==="
echo "Working directory: $ROOT"
echo ""

# Load .env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo -e "${GREEN}Loaded .env${NC}"
else
  echo -e "${RED}Missing .env — copy .env.example to .env and fill in values.${NC}"
  exit 1
fi

REQUIRED_VARS=(
  DATABASE_URL
  SESSION_SECRET
  SESSION_ENCRYPTION_KEY
  APP_BASE_URL
  CLIENT_URL
  OPENAI_API_KEY
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done

MOCK_MODE="${MOCK_OAUTH_MODE:-false}"
if [[ "$MOCK_MODE" != "true" ]]; then
  OAUTH_VARS=(
    ETSY_CLIENT_ID
    ETSY_CLIENT_SECRET
    EBAY_CLIENT_ID
    EBAY_CLIENT_SECRET
    SHOPIFY_CLIENT_ID
    SHOPIFY_CLIENT_SECRET
  )
  OAUTH_SET=0
  for var in "${OAUTH_VARS[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      OAUTH_SET=1
      break
    fi
  done
  if [[ "$OAUTH_SET" -eq 0 ]]; then
    MISSING+=("(at least one OAuth marketplace: ETSY_*, EBAY_*, or SHOPIFY_* — or set MOCK_OAUTH_MODE=true for staging)")
  fi
else
  echo -e "${YELLOW}MOCK_OAUTH_MODE=true — skipping live OAuth credential check${NC}"
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}Missing required environment variables:${NC}"
  for var in "${MISSING[@]}"; do
    echo "  • $var"
  done
  echo ""
  echo "See DEPLOY_BACKEND.md and .env.example"
  exit 1
fi

echo -e "${GREEN}Required environment variables OK${NC}"
echo ""

# --- Database migrations ---
echo "=== Running database migrations ==="
if ! npm run db:migrate; then
  echo -e "${YELLOW}db:migrate failed — you may need to apply supplemental SQL manually.${NC}"
  echo "See DEPLOY_BACKEND.md §4 for migrations/20260609_*.sql files."
  read -r -p "Continue with build anyway? [y/N] " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
echo ""

# --- Build ---
echo "=== Building web app + server (npm run build) ==="
npm run build
echo -e "${GREEN}Build complete — output in dist/ and Vite dist/${NC}"
echo ""

# --- PM2 ---
APP_BASE="${APP_BASE_URL%/}"
PORT="${PORT:-2626}"

echo "=== PM2 — start backend ==="
cat <<EOF
pm2 start dist/index.js --name kauf26-api \\
  --cwd "$ROOT" \\
  --env production

# Or use an ecosystem file:
# pm2 start ecosystem.config.cjs
# pm2 save && pm2 startup

# API listens on PORT=$PORT — proxy HTTPS to this from nginx/Caddy.
EOF
echo ""

echo "=== Serve web static files ==="
cat <<'EOF'
# Option A: nginx serves Vite dist/ at CLIENT_URL
#   root /var/www/kauf26/dist/client;  (adjust to your vite outDir)
#   proxy /api to http://127.0.0.1:2626

# Option B: PM2 serve (simple)
#   npm install -g serve
#   pm2 start "serve -s dist -l 5173" --name kauf26-web
EOF
echo ""

# --- Docker Compose snippet ---
echo "=== Docker Compose snippet (optional) ==="
cat <<EOF
# Save as docker-compose.prod.yml and customize. Requires a Dockerfile for the API.
#
# services:
#   api:
#     build: .
#     env_file: .env
#     ports:
#       - "127.0.0.1:${PORT}:${PORT}"
#     restart: unless-stopped
#   # Use external managed Postgres — set DATABASE_URL in .env
#
# docker compose -f docker-compose.prod.yml up -d api
EOF
echo ""

# --- OAuth redirect checklist ---
echo "=== OAuth redirect URI checklist ==="
echo "Register this callback in each marketplace developer portal:"
echo ""
echo -e "  ${GREEN}${APP_BASE}/api/auth/callback${NC}"
echo ""
echo "Marketplaces:"
echo "  [ ] Etsy   — https://www.etsy.com/developers/your-apps"
echo "  [ ] eBay   — https://developer.ebay.com/my/keys"
echo "  [ ] Shopify — Partners → App → Allowed redirection URL(s)"
echo "  [ ] Amazon — Login with Amazon → Allowed Return URLs"
echo ""
echo "Also verify:"
echo "  [ ] APP_BASE_URL=${APP_BASE}"
echo "  [ ] CLIENT_URL=${CLIENT_URL}"
echo "  [ ] HTTPS certificates valid on API and web"
echo "  [ ] MOCK_OAUTH_MODE=false in production"
echo "  [ ] mobile EXPO_PUBLIC_API_URL matches APP_BASE_URL"
echo ""
echo "Next steps:"
echo "  1. Start API with PM2 (commands above)"
echo "  2. Serve web app + verify /privacy and /terms"
echo "  3. Run: npm run verify:store-readiness"
echo "  4. Run MANUAL_QA.md checklist"
echo "  5. mobile/scripts/build-and-submit.sh for EAS builds"
echo ""
echo -e "${GREEN}Deployment preparation finished.${NC}"
