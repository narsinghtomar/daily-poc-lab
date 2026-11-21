#!/usr/bin/env bash
# Records the feed demo from a connected Android device or a booted iOS
# simulator, then makes a small GIF for the README.
#
#   scripts/record-demo.sh android flash   # or: ios flat
#
# Output: docs/media/feed-<list>-<platform>.mp4 and .gif
# Needs adb (Android) or Xcode command line tools (iOS), plus ffmpeg.
set -euo pipefail

platform="${1:-android}"
list="${2:-flash}"
seconds="${SECONDS_TO_RECORD:-25}"
out_dir="$(cd "$(dirname "$0")/.." && pwd)/docs/media"
base="$out_dir/feed-$list-$platform"
mkdir -p "$out_dir"

case "$list" in flash|flat) ;; *) echo "list must be flash or flat" >&2; exit 64 ;; esac
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 69; }

echo "Start the app with: EXPO_PUBLIC_FEED_LIST=$list yarn start"
echo "Recording $seconds s. Scroll to the end, pull to refresh, like a few rows."

case "$platform" in
  android)
    command -v adb >/dev/null || { echo "adb is required" >&2; exit 69; }
    # Show touches so taps and flings are visible in the recording.
    adb shell settings put system show_touches 1
    trap 'adb shell settings put system show_touches 0' EXIT
    adb shell screenrecord --time-limit "$seconds" --bit-rate 6000000 /sdcard/feed-demo.mp4
    adb pull /sdcard/feed-demo.mp4 "$base.mp4" >/dev/null
    adb shell rm /sdcard/feed-demo.mp4
    ;;
  ios)
    command -v xcrun >/dev/null || { echo "xcrun is required" >&2; exit 69; }
    xcrun simctl io booted recordVideo --codec h264 --force "$base.mp4" &
    rec=$!
    sleep "$seconds"
    kill -INT "$rec"
    wait "$rec" || true
    ;;
  *) echo "platform must be android or ios" >&2; exit 64 ;;
esac

# 12 fps, 360 px wide, shared palette: small enough to embed in a README.
ffmpeg -loglevel error -y -i "$base.mp4" \
  -vf "fps=12,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" \
  "$base.gif"
echo "Wrote $base.mp4 and $base.gif"
