#!/usr/bin/env bash
# Verify Xcode / iOS Simulator tooling for Expo (run: ./scripts/verify-xcode-simctl.sh)

set -euo pipefail

echo "=== Xcode / simctl check ==="
echo

if ! command -v xcode-select >/dev/null 2>&1; then
  echo "xcode-select not found. Install Xcode Command Line Tools:"
  echo "  xcode-select --install"
  exit 1
fi

DEV_PATH="$(xcode-select -p 2>/dev/null || true)"
echo "Active developer directory: ${DEV_PATH:-<none>}"

if [[ "$DEV_PATH" == *"CommandLineTools"* ]]; then
  echo
  echo "WARNING: Only Command Line Tools are selected."
  echo "Expo iOS builds need full Xcode.app. Install Xcode from the App Store, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Run: xcode-select --install"
  exit 1
fi

echo
echo "Running: xcrun simctl list devices available (first 15 lines)..."
if xcrun simctl list devices available 2>&1 | head -15; then
  echo
  echo "OK — simctl is working."
else
  CODE=$?
  echo
  echo "simctl failed (exit $CODE). Common fixes:"
  echo "  1. Open Xcode.app once and accept the license agreement."
  echo "  2. Xcode → Settings → Accounts → add your Apple ID (development team)."
  echo "  3. sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "  4. xcodebuild -runFirstLaunch"
  exit "$CODE"
fi
