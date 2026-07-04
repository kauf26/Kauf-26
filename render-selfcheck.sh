#!/usr/bin/env bash
# Render deployment self-check for Kauf26.
# Usage:
#   bash render-selfcheck.sh                       # checks kauf-26.onrender.com
#   bash render-selfcheck.sh https://api.kaufai.com # check the custom domain
set -u

BASE_URL="${1:-https://kauf-26.onrender.com}"
PROVIDERS=(etsy shopify ebay)

hr() { printf '%s\n' "------------------------------------------------------------"; }

# Returns the HTTP status code for a quick reachability probe.
probe() { curl -s -o /dev/null -w "%{http_code}" -m 20 "$1"; }

hr
echo "RENDER SELF-CHECK  ->  $BASE_URL"
echo "$(date)"
hr

# 0. Reachability + guard against 502/HTML (service down or restarting).
health_code="$(probe "$BASE_URL/api/health")"
echo "0. Reachability: HTTP $health_code"
case "$health_code" in
  200) : ;;
  000) echo "   !! No response (timeout/DNS). Service unreachable."; exit 1 ;;
  502|503|504) echo "   !! Service is DOWN or restarting (Bad Gateway). Check Render Events/Logs, then retry."; exit 1 ;;
  *) echo "   !! Unexpected status. Check Render dashboard."; exit 1 ;;
esac

echo ""
echo "1. Health:"
curl -s -m 20 "$BASE_URL/api/health"; echo ""

echo ""
echo "2. Configured marketplaces:"
curl -s -m 20 "$BASE_URL/api/marketplaces/oauth-config" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('   CONFIGURED:',[p['id'] for p in d.get('configured',[])])" 2>/dev/null \
  || echo "   (could not parse oauth-config)"

echo ""
echo "3. Marketplace OAuth URLs  (url=configured / error=missing):"
for p in "${PROVIDERS[@]}"; do
  printf "   %-9s" "$p:"
  curl -s -m 20 "$BASE_URL/api/auth/$p/url"; echo ""
done

echo ""
echo "4. Google OAuth  (302=configured / 404=missing):"
curl -s -o /dev/null -w "   google:  %{http_code} -> %{redirect_url}\n" -m 20 "$BASE_URL/api/auth/google"

echo ""
echo "5. Apple mobile  (401=configured correctly / 503=missing):"
curl -s -o /dev/null -w "   apple:   %{http_code}\n" -m 20 \
  -X POST "$BASE_URL/api/auth/mobile/apple" \
  -H "Content-Type: application/json" -d '{"identityToken":"bad"}'

hr
echo "Done."
hr
