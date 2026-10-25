#!/usr/bin/env bash
# Runs hourly on your Mac (via launchd). Ships the day's work only when the
# daily Claude build has finished and left the .autoship-ready marker.
# Never makes empty commits.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="$REPO/.autoship.log"
ts() { date '+%Y-%m-%d %H:%M:%S'; }

[[ -f .autoship-ready ]] || { echo "$(ts) no marker, nothing to ship" >> "$LOG"; exit 0; }

git pull --rebase --autostash -q >> "$LOG" 2>&1 || true

if [[ -z "$(git status --porcelain)" ]]; then
  echo "$(ts) marker found but no changes" >> "$LOG"
  rm -f .autoship-ready
  exit 0
fi

MSG="$(head -n1 .autoship-ready)"
rm -f .autoship-ready
if [[ -n "$MSG" ]]; then
  node scripts/lab.js ship "$MSG" >> "$LOG" 2>&1
else
  node scripts/lab.js ship >> "$LOG" 2>&1
fi
STATUS=$?
echo "$(ts) ship exit $STATUS" >> "$LOG"
if [[ $STATUS -eq 0 ]]; then
  NOTE="${MSG:-Daily milestone}"
  NOTE="${NOTE//\"/}"
  osascript -e "display notification \"$NOTE pushed to GitHub\" with title \"POC Lab\"" 2>/dev/null || true
else
  osascript -e 'display notification "Auto-ship failed. See .autoship.log" with title "POC Lab"' 2>/dev/null || true
fi
