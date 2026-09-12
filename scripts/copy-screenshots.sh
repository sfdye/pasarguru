#!/bin/sh
# Copy the latest Maestro screenshots into store/ios/screenshots/<locale>/{iphone,ipad}/.
# Run after `npm run screenshots:ios` or `npm run screenshots:ios:ipad`.
#
# Maestro writes to ~/.maestro/tests/<timestamp>/<flow-name>/takeScreenshot/.
# This script finds the most recent run for each flow name and copies the PNGs.
set -eu

DEST="store/ios/screenshots"
FLOWS="screenshots screenshots-zh screenshots-ipad screenshots-ipad-zh"

for flow in $FLOWS; do
  src=$(ls -td "$HOME"/.maestro/tests/*/"$flow"/takeScreenshot 2>/dev/null | head -1)
  if [ -z "$src" ]; then
    echo "No screenshots found for flow: $flow"
    continue
  fi

  case "$flow" in
    screenshots-zh|screenshots-ipad-zh) locale="zh-Hans" ;;
    *) locale="en-US" ;;
  esac
  device=iphone
  case "$flow" in screenshots-ipad*) device=ipad ;; esac

  echo "Copying $flow → $DEST/$locale/$device/"
  cp "$src"/*.png "$DEST/$locale/$device/"
done

echo "Done. Run 'npm run metadata:ios' to resize and upload."
