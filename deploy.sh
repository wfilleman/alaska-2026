#!/usr/bin/env bash
# Re-encrypt and redeploy alaska-2026.html to GitHub Pages.
#
# Usage: ./deploy.sh "commit message"
#
# Expects ./alaska-2026.html to be the source (will be overwritten in-place
# by staticrypt with the encrypted version, then renamed to index.html).
#
# Reads the passphrase from $STATICRYPT_PASSWORD or prompts.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ICLOUD_DIR="/Users/wesleyfilleman/Library/Mobile Documents/com~apple~CloudDocs/Alaska 2026"
SOURCE_HTML="$ICLOUD_DIR/alaska-2026.html"
SOURCE_MAPS_DIR="$ICLOUD_DIR/maps"
COMMIT_MSG="${1:-Update content}"

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
  echo "Error: set STATICRYPT_PASSWORD env var before running." >&2
  exit 1
fi

cd "$DEPLOY_DIR"

echo "[1/7] Copy fresh HTML + maps + emergency PDF from iCloud..."
cp "$SOURCE_HTML" alaska-2026.html
# Replace maps/ dir so removed renders don't linger
rm -rf maps
mkdir -p maps
if [ -d "$SOURCE_MAPS_DIR" ]; then
  cp "$SOURCE_MAPS_DIR"/*.mp4 maps/
  echo "  copied $(ls maps/ | wc -l | tr -d ' ') MP4s"
else
  echo "  warning: no maps directory at $SOURCE_MAPS_DIR" >&2
fi
# One-page emergency card PDF (contact list, confirmations, lodges, hospital)
if [ -f "$ICLOUD_DIR/emergency-card.pdf" ]; then
  cp "$ICLOUD_DIR/emergency-card.pdf" emergency-card.pdf
  echo "  copied emergency-card.pdf ($(wc -c < emergency-card.pdf) bytes)"
fi

echo "[2/7] Stamp build version + date into title slide..."
# Version = (current main commit count) + 1, since this commit hasn't happened yet
NEXT_VERSION=$(( $(git rev-list --count HEAD 2>/dev/null || echo 0) + 1 ))
BUILD_DATE=$(date "+%b %-d, %Y")
perl -i -pe "s/BUILD_VERSION_TOKEN/${NEXT_VERSION}/g" alaska-2026.html
perl -i -pe "s/BUILD_DATE_TOKEN/${BUILD_DATE}/g" alaska-2026.html
echo "  v${NEXT_VERSION} · ${BUILD_DATE}"

echo "[3/7] Encrypt with staticrypt..."
npx --yes staticrypt alaska-2026.html --remember 365 --short -d . > /dev/null

echo "[4/7] Inject PWA meta tags into gate page head..."
# Use perl for a single-pass head injection that's idempotent (won't double-inject).
perl -i -0pe '
  s{<title>Protected Page</title>}{<title>Alaska 2026 \xc2\xb7 Filleman Family Voyage</title>
        <meta name="robots" content="noindex,nofollow,noarchive">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Alaska 2026">
        <meta name="theme-color" content="#0c2333">
        <link rel="manifest" href="manifest.json">
        <link rel="apple-touch-icon" href="icon.png">
        <script>
          if ("serviceWorker" in navigator \&\& location.protocol === "https:") {
            window.addEventListener("load", () => {
              navigator.serviceWorker.register("sw.js").catch(() => {});
            });
          }
        </script>};
' alaska-2026.html

echo "[5/7] Rename to index.html..."
mv alaska-2026.html index.html

echo "[6/7] Bump service-worker cache version..."
# Replace the placeholder token (or any prior cache id) with a fresh timestamp
# so browsers detect the SW change, install the new SW, and purge stale caches.
NEW_CACHE_ID="$(date +%s)"
perl -i -pe "s/alaska-2026-[A-Za-z0-9_-]+/alaska-2026-${NEW_CACHE_ID}/g" sw.js
echo "  new CACHE id: alaska-2026-${NEW_CACHE_ID}"

echo "[7/7] git add + commit + push..."
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed."
  exit 0
fi
git -c user.name="WfIlleman" -c user.email="wes@mobileintegratedsolutions.com" commit -m "$COMMIT_MSG"
git push -q origin main

echo ""
echo "Deployed. URL: https://wfilleman.github.io/alaska-2026/"
echo "Pages build is queued; will be live in 30-90 seconds."
