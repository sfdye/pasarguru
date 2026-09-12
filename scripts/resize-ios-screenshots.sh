#!/bin/sh
# Resize iOS screenshots to ASC-supported dimensions before uploading.
# iphone/ → 1242×2688 (6.5" display)
# ipad/   → 2064×2752 (13" iPad Pro M4)
for f in store/ios/screenshots/*/iphone/*.png; do
  [ -f "$f" ] || continue
  sips -z 2688 1242 "$f" >/dev/null 2>&1
done
for f in store/ios/screenshots/*/ipad/*.png; do
  [ -f "$f" ] || continue
  sips -z 2752 2064 "$f" >/dev/null 2>&1
done
