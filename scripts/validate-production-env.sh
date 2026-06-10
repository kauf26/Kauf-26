#!/usr/bin/env bash
#
# Kauf26 production environment validator.
# Run on the deployment server after configuring .env (and ideally after deploy).
#
# Usage:
#   bash scripts/validate-production-env.sh
#   bash scripts/validate-production-env.sh --skip-http   # env + DB only (pre-deploy)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

SKIP_HTTP=0
if [[ "${1:-}" == "--skip-http" ]]; then
  SKIP_HTTP=1
fi

PASSED=0
WARNED=0
FAILED=0

pass() {
  echo -e "${GREEN}✓${NC} $1${2:+ ${DIM}— $2${NC}}"
  PASSED=$((PASSED + 1))
}

warn() {
  echo -e "${YELLOW}!${NC} $1${2:+ ${DIM}— $2${NC}}"
  WARNED=$((WARNED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1${2:+ ${DIM}— $2${NC}}"
  FAILED=$((FAILED + 1))
}

is_local_url() {
  [[ "$1" =~ localhost|127\.0\.0\.1|0\.0\.0\.0 ]]
}

http_status() {
  local url="$1"
  curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 8 --max-time 15 "$url" 2>/dev/null || echo "000"
}

echo ""
echo "=== Kauf26 Production Environment Validator ==="
echo ""

# --- Load .env ---
if [[ ! -f .env ]]; then
  fail ".env file" "Missing — copy .env.example to .env"
  echo ""
  echo -e "${RED}NOT VALID${NC} — fix failures above."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a
pass ".env loaded" "$ROOT/.env"

# --- Core required variables ---
CORE_VARS=(
  DATABASE_URL
  SESSION_SECRET
  SESSION_ENCRYPTION_KEY
  APP_BASE_URL
  CLIENT_URL
  OPENAI_API_KEY
)

for var in "${CORE_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    fail "Env: $var" "not set"
  else
    if [[ "$var" == *URL* ]] && is_local_url "${!var}"; then
      warn "Env: $var" "localhost/dev value: ${!var}"
    elif [[ "$var" == *SECRET* ]] || [[ "$var" == *KEY* ]]; then
      pass "Env: $var" "set"
    else
      pass "Env: $var" "${!var%/}"
    fi
  fi
done

# --- MOCK mode ---
if [[ "${MOCK_OAUTH_MODE:-false}" == "true" ]]; then
  warn "MOCK_OAUTH_MODE" "true — not for production store release"
else
  pass "MOCK_OAUTH_MODE" "false or unset"
fi

# --- Marketplace OAuth pairs ---
OAUTH_PAIRS=(
  "Etsy:ETSY_CLIENT_ID:ETSY_CLIENT_SECRET"
  "eBay:EBAY_CLIENT_ID:EBAY_CLIENT_SECRET"
  "Shopify:SHOPIFY_CLIENT_ID:SHOPIFY_CLIENT_SECRET"
  "Amazon:AMAZON_CLIENT_ID:AMAZON_CLIENT_SECRET"
)

CONFIGURED_MARKETPLACES=0
for entry in "${OAUTH_PAIRS[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  id_var="${rest%%:*}"
  secret_var="${rest#*:}"
  id_val="${!id_var:-}"
  secret_val="${!secret_var:-}"

  if [[ -n "$id_val" && -n "$secret_val" ]]; then
    pass "OAuth: $name" "client ID + secret configured"
    CONFIGURED_MARKETPLACES=$((CONFIGURED_MARKETPLACES + 1))
  elif [[ -n "$id_val" || -n "$secret_val" ]]; then
    fail "OAuth: $name" "incomplete — set both $id_var and $secret_var"
  else
    warn "OAuth: $name" "not configured (optional unless you support this marketplace)"
  fi
done

if [[ "$CONFIGURED_MARKETPLACES" -eq 0 && "${MOCK_OAUTH_MODE:-false}" != "true" ]]; then
  fail "OAuth marketplaces" "none fully configured — set at least Etsy, eBay, or Shopify"
fi

# Amazon seller ID (required for Amazon publish)
if [[ -n "${AMAZON_CLIENT_ID:-}" ]]; then
  if [[ -z "${AMAZON_SELLER_ID:-}" ]]; then
    fail "Env: AMAZON_SELLER_ID" "required when Amazon OAuth is configured"
  else
    pass "Env: AMAZON_SELLER_ID" "set"
  fi
fi

# --- Database connectivity ---
if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "Database connectivity" "DATABASE_URL not set"
else
  DB_RESULT=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "
    import pg from 'pg';
    const url = process.env.DATABASE_URL;
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      const r = await client.query('SELECT 1 AS ok');
      await client.end();
      console.log(r.rows[0]?.ok === 1 ? 'OK' : 'FAIL');
    } catch (e) {
      console.log('ERR:' + (e.message || e));
      process.exit(0);
    }
  " 2>/dev/null || echo "ERR:node failed")

  if [[ "$DB_RESULT" == "OK" ]]; then
    pass "Database connectivity" "SELECT 1 succeeded"
  elif [[ "$DB_RESULT" == ERR:* ]]; then
    fail "Database connectivity" "${DB_RESULT#ERR:}"
  else
    fail "Database connectivity" "unexpected result: $DB_RESULT"
  fi
fi

# --- HTTP checks ---
if [[ "$SKIP_HTTP" -eq 1 ]]; then
  warn "HTTP checks" "skipped (--skip-http)"
else
  APP_BASE="${APP_BASE_URL%/}"
  CLIENT_BASE="${CLIENT_URL%/}"

  if [[ -n "${APP_BASE:-}" ]]; then
    HEALTH_URL="${APP_BASE}/api/health"
    CODE=$(http_status "$HEALTH_URL")
    if [[ "$CODE" == "200" ]]; then
      pass "API health" "$HEALTH_URL → 200"
    elif [[ "$CODE" == "000" ]]; then
      if is_local_url "$APP_BASE"; then
        warn "API health" "unreachable at $HEALTH_URL — start server or use production URL"
      else
        fail "API health" "unreachable at $HEALTH_URL"
      fi
    else
      fail "API health" "$HEALTH_URL → HTTP $CODE (expected 200)"
    fi
  fi

  if [[ -n "${CLIENT_BASE:-}" ]]; then
    for path in privacy terms; do
      PAGE_URL="${CLIENT_BASE}/${path}"
      CODE=$(http_status "$PAGE_URL")
      if [[ "$CODE" == "200" ]]; then
        pass "Legal page /${path}" "$PAGE_URL → 200"
      elif [[ "$CODE" == "000" ]]; then
        if is_local_url "$CLIENT_BASE"; then
          warn "Legal page /${path}" "unreachable at $PAGE_URL — deploy web app first"
        else
          fail "Legal page /${path}" "unreachable at $PAGE_URL"
        fi
      else
        fail "Legal page /${path}" "$PAGE_URL → HTTP $CODE (expected 200)"
      fi
    done
  fi
fi

# --- Summary ---
echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}PRODUCTION ENV VALID${NC} — $PASSED passed, $WARNED warning(s)."
  if [[ "$WARNED" -gt 0 ]]; then
    echo "Review warnings before store submission."
  fi
  exit 0
else
  echo -e "${RED}PRODUCTION ENV INVALID${NC} — $FAILED failed, $WARNED warning(s), $PASSED passed."
  echo "See DEPLOY_BACKEND.md and HANDOFF_TO_USER.md"
  exit 1
fi
