#!/usr/bin/env bash
# Usage: ./stills.sh 0.3 1.2 2.4  -> stills/t0.30.png ... (540x960, scale 1)
cd "$(dirname "$0")"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
URL="file:///$(pwd -W)/index.html"
for t in "$@"; do
  out="$(pwd -W)/stills/${STYLE:+$STYLE-}t$t.png"
  "$CHROME" --headless=new --disable-gpu-sandbox --hide-scrollbars --window-size=${WIN:-540,960} \
    --virtual-time-budget=4000 --screenshot="$out" "$URL?t=$t&ui=0&s=${SCALE:-1}${STYLE:+&style=$STYLE}" >/dev/null 2>&1
  echo "$out"
done
