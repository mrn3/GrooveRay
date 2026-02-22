#!/usr/bin/env bash
# Add an IP to the production server's banned list and restart the app.
# Usage: ./scripts/ban-ip.sh 1.2.3.4
# Uses SSH_HOST=shared by default (same as deploy).

set -e
IP="${1:?Usage: $0 <IP_ADDRESS>}"
# Basic validation: allow IPv4 and simple format
if ! [[ "$IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "Error: $IP does not look like an IPv4 address."
  exit 1
fi
SSH_HOST="${SSH_HOST:-shared}"
REMOTE_REPO="${REPO_DIR:-~/GrooveRay}"

echo "Banning IP $IP on $SSH_HOST (backend at $REMOTE_REPO/backend)..."
ssh "$SSH_HOST" "bash -s" -- "$REMOTE_REPO" "$IP" << 'REMOTE'
set -e
REPO="${1:?}"
IP="${2:?}"
[[ "$REPO" == ~* ]] && REPO="$HOME${REPO:1}"
FILE="$REPO/backend/banned-ips.txt"
mkdir -p "$(dirname "$FILE")"
if [[ -f "$FILE" ]] && grep -qxF "$IP" "$FILE" 2>/dev/null; then
  echo "IP $IP is already in the banned list."
else
  echo "$IP" >> "$FILE"
  echo "Added $IP to $FILE"
fi
# Restart app so it reloads the list (Node reads file at startup)
if command -v pm2 >/dev/null 2>&1; then
  cd "$REPO" && pm2 restart grooveray 2>/dev/null && echo "Restarted grooveray." || true
fi
REMOTE
echo "Done."
