#!/usr/bin/env bash
#
# Kauf26 mobile — EAS production build + optional submit.
# Requires: eas-cli, eas login (or EXPO_TOKEN), configured eas.json.
# Does NOT run automatically in CI unless EXPO_TOKEN is set.
#
set -euo pipefail

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MOBILE_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BUILD_IOS=1
BUILD_ANDROID=1
AUTO_SUBMIT=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  --ios-only       Build iOS production only
  --android-only   Build Android production only
  --submit         Prompt to run eas submit after builds
  -h, --help       Show this help

Requires mobile/.env or EAS Secrets with:
  EXPO_PUBLIC_API_URL
  EXPO_PUBLIC_WEB_BASE_URL (or EXPO_PUBLIC_PRIVACY_URL + EXPO_PUBLIC_TERMS_URL)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ios-only)
      BUILD_ANDROID=0
      shift
      ;;
    --android-only)
      BUILD_IOS=0
      shift
      ;;
    --submit)
      AUTO_SUBMIT=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      usage
      exit 1
      ;;
  esac
done

echo "=== Kauf26 EAS production build ==="
echo "Directory: $MOBILE_ROOT"
echo ""

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo -e "${GREEN}Loaded mobile/.env${NC}"
else
  echo -e "${YELLOW}No mobile/.env — assuming EAS Secrets are configured in Expo dashboard${NC}"
fi

if ! command -v eas >/dev/null 2>&1; then
  echo -e "${RED}eas-cli not found. Install: npm install -g eas-cli${NC}"
  exit 1
fi

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo -e "${YELLOW}Tip: run 'eas login' or set EXPO_TOKEN for non-interactive builds${NC}"
fi

export APP_ENV=production
echo "=== Validating production environment ==="
npm run validate:production-env
echo ""

if [[ "$BUILD_IOS" -eq 1 ]]; then
  echo "=== EAS build: iOS (production) ==="
  eas build --platform ios --profile production --non-interactive=false
  echo -e "${GREEN}iOS build queued/completed — check Expo dashboard for artifact${NC}"
  echo ""
fi

if [[ "$BUILD_ANDROID" -eq 1 ]]; then
  echo "=== EAS build: Android (production / AAB) ==="
  eas build --platform android --profile production --non-interactive=false
  echo -e "${GREEN}Android build queued/completed — check Expo dashboard for AAB${NC}"
  echo ""
fi

echo "=== Submit to stores (manual) ==="
echo "After builds finish, submit with:"
echo ""
echo "  eas submit --platform ios --profile production"
echo "  eas submit --platform android --profile production"
echo ""
echo "See mobile/MOBILE_SUBMISSION.md for App Store Connect and Play Console credentials."
echo ""

RUN_SUBMIT=""
if [[ "$AUTO_SUBMIT" -eq 1 ]]; then
  RUN_SUBMIT="y"
else
  read -r -p "Run eas submit now for completed platforms? [y/N] " RUN_SUBMIT || true
fi

if [[ "$RUN_SUBMIT" =~ ^[Yy]$ ]]; then
  if [[ "$BUILD_IOS" -eq 1 ]]; then
    echo "=== EAS submit: iOS ==="
    eas submit --platform ios --profile production
  fi
  if [[ "$BUILD_ANDROID" -eq 1 ]]; then
    echo "=== EAS submit: Android ==="
    eas submit --platform android --profile production
  fi
  echo -e "${GREEN}Submit commands finished.${NC}"
else
  echo "Skipped submit — run eas submit manually when builds are ready."
fi

echo ""
echo -e "${GREEN}Build script complete.${NC}"
