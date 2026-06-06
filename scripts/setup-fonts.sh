#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FONTS_DIR="$ROOT/public/fonts"
ZIP="$FONTS_DIR/F1-Font-Files-with-important-Message.zip"
URL="https://www.dropbox.com/s/e5wrz81xmurwdwu/F1-Font-Files-with-important-Message.zip?dl=1"

mkdir -p "$FONTS_DIR"

echo "Downloading F1 fonts..."
if ! curl -fsSL -A "Mozilla/5.0" "$URL" -o "$ZIP"; then
  echo "Download failed. Grab the zip manually from:"
  echo "https://imjustcreative.com/download-f1-fonts-formula-1-fonts/2025/05/16"
  exit 1
fi

if ! file "$ZIP" | grep -qi zip; then
  echo "Download did not return a zip (Dropbox may need manual download)."
  echo "Save the zip to: $ZIP then re-run this script."
  rm -f "$ZIP"
  exit 1
fi

echo "Extracting..."
unzip -o "$ZIP" -d "$FONTS_DIR"
rm -f "$ZIP"

echo "Done. Font files in public/fonts/"
ls -la "$FONTS_DIR"
