#!/usr/bin/env bash
# Pings a URL on an interval to stop a free-tier host (e.g. Render) from spinning down mid-event.
# Usage: ./scripts/keep-alive.sh https://your-backend.onrender.com [interval_seconds]
# Stop with Ctrl+C when the quiz is over.

set -euo pipefail

URL="${1:?Usage: $0 <url> [interval_seconds]}"
INTERVAL="${2:-300}" # default: every 5 minutes, well under Render's 15-minute spin-down

echo "Pinging $URL every ${INTERVAL}s. Press Ctrl+C to stop."

while true; do
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || echo "unreachable")"
  echo "[$timestamp] $URL -> $status"
  sleep "$INTERVAL"
done
