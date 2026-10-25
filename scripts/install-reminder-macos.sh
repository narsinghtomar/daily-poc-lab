#!/usr/bin/env bash
# Installs a macOS LaunchAgent that checks at 20:30 every day whether you
# committed to this repo, and shows a notification with today's milestone if not.
# It never commits for you.
#
#   ./scripts/install-reminder-macos.sh          # install (default 20:30)
#   ./scripts/install-reminder-macos.sh 21 15    # install at 21:15
#   ./scripts/install-reminder-macos.sh --remove # uninstall

set -euo pipefail
LABEL="dev.poclab.reminder"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" == "--remove" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Reminder removed."
  exit 0
fi

HOUR="${1:-20}"
MINUTE="${2:-30}"
NODE="$(command -v node)"
[[ -z "$NODE" ]] && { echo "node not found in PATH"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/scripts/lab.js</string>
    <string>check</string>
    <string>--notify</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>$MINUTE</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/poclab-reminder.log</string>
  <key>StandardErrorPath</key><string>/tmp/poclab-reminder.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
printf "Reminder installed: daily at %02d:%02d\n" "$HOUR" "$MINUTE"
echo "Test it now: launchctl start $LABEL"
