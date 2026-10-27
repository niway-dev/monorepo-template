#!/usr/bin/env bash
# Drive the real app on the iOS simulator and record proof for a PR.
# Usage: scripts/verify.sh <scenario>      (scenarios: launch | sign-in | sign-up)
# Output: .verify/<scenario>/{screenshot.png,video.mov,metro.log} (gitignored)
# Env:    VERIFY_DEVICE  simulator name (default "iPhone 17 Pro")
#         VERIFY_TARGET  expo-go (default) | dev-build (installed build opened via its scheme)
#         VERIFY_PORT    Metro port (default 8081)
#         VERIFY_SETTLE  seconds to wait after each navigation (default 6)
#         VERIFY_KEEP_SIM=1  leave the simulator booted afterwards
set -euo pipefail

SCENARIO="${1:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE="${VERIFY_DEVICE:-iPhone 17 Pro}"
TARGET="${VERIFY_TARGET:-expo-go}"
PORT="${VERIFY_PORT:-8081}"
SETTLE="${VERIFY_SETTLE:-6}"
OUT="$APP_DIR/.verify/$SCENARIO"

# Routes per scenario: space-separated, visited in order; the last one is captured.
case "$SCENARIO" in
  launch)  ROUTES="" ;;          # cold start, no deep link: whatever the app opens on
  sign-in) ROUTES="sign-in" ;;
  sign-up) ROUTES="sign-up" ;;
  *) echo "Unknown scenario '$SCENARIO'. Use: launch | sign-in | sign-up" >&2; exit 2 ;;
esac

# Scheme comes from app.json so a renamed project keeps working.
SCHEME="$(cd "$APP_DIR" && node -p "require('./app.json').expo.scheme")"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:8787}"

mkdir -p "$OUT"
rm -f "$OUT/screenshot.png" "$OUT/video.mov"

# Boot the simulator by name unless one is already booted.
BOOTED_BY_US=0
if ! xcrun simctl list devices booted | grep -q "(Booted)"; then
  UDID="$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | grep -oE '[0-9A-F-]{36}')"
  [ -n "$UDID" ] || { echo "No available simulator named '$DEVICE'" >&2; exit 1; }
  xcrun simctl boot "$UDID"
  BOOTED_BY_US=1
fi
xcrun simctl bootstatus booted -b >/dev/null

METRO_PID=""; REC_PID=""
cleanup() {
  [ -n "$REC_PID" ] && kill -INT "$REC_PID" 2>/dev/null && wait "$REC_PID" 2>/dev/null || true
  if [ -n "$METRO_PID" ]; then
    kill "$METRO_PID" 2>/dev/null || true
    # npx spawns children that outlive the subshell; free the port too.
    lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  fi
  if [ "$BOOTED_BY_US" = 1 ] && [ "${VERIFY_KEEP_SIM:-0}" != 1 ]; then
    xcrun simctl shutdown booted 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Expo Go: installed by this script, not by `expo start --ios`, because the Expo CLI
# needs Simulator.app (a headless simctl boot, or an Xcode without it, breaks that path).
install_expo_go() {
  xcrun simctl get_app_container booted host.exp.Exponent >/dev/null 2>&1 && return 0
  local sdk url cache
  sdk="$(cd "$APP_DIR" && node -p "require('expo/package.json').version.split('.')[0]")"
  url="$(curl -sf https://api.expo.dev/v2/versions/latest | node -p \
    "JSON.parse(require('fs').readFileSync(0)).data.sdkVersions['$sdk.0.0'].iosClientUrl")"
  cache="${XDG_CACHE_HOME:-$HOME/.cache}/verify-expo-go/$sdk"
  if [ ! -d "$cache/Expo Go.app" ]; then
    mkdir -p "$cache/Expo Go.app" && curl -sfL "$url" | tar -xz -C "$cache/Expo Go.app"
  fi
  xcrun simctl install booted "$cache/Expo Go.app"
}

if [ "$TARGET" = expo-go ]; then
  install_expo_go
  (cd "$APP_DIR" && CI=1 npx expo start --port "$PORT" >"$OUT/metro.log" 2>&1) &
  METRO_PID=$!
  for _ in $(seq 1 120); do
    curl -sf "http://localhost:$PORT/status" 2>/dev/null | grep -q running && break
    sleep 1
  done
  root="exp://127.0.0.1:$PORT"; base="$root/--/"
else
  root="$SCHEME://"; base="$SCHEME://"
fi

xcrun simctl io booted recordVideo --codec=h264 --force "$OUT/video.mov" >"$OUT/record.log" 2>&1 &
REC_PID=$!
sleep 2

# Navigation. Expo Go asks "Open in Expo Go?" for every `simctl openurl` and simctl cannot
# tap, so for Expo Go the URL goes in as a launch argument instead (no prompt).
open_url() {
  if [ "$TARGET" = expo-go ]; then
    xcrun simctl launch --terminate-running-process booted host.exp.Exponent \
      -EXKernelLaunchUrlDefaultsKey "$1" >/dev/null
  else
    xcrun simctl openurl booted "$1"
  fi
  sleep "$SETTLE"
}
open_url "$root"
for r in $ROUTES; do open_url "$base$r"; done

xcrun simctl io booted screenshot "$OUT/screenshot.png"
kill -INT "$REC_PID"; wait "$REC_PID" 2>/dev/null || true; REC_PID=""

ls -l "$OUT/screenshot.png" "$OUT/video.mov"
