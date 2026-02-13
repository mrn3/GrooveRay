#!/usr/bin/env bash
#
# Set Google OAuth env vars on the server (backend/.env) and restart PM2.
# Uses same SSH host and repo path as deploy.sh.
#
# Usage:
#   GOOGLE_CLIENT_SECRET='your-secret' ./scripts/set-google-oauth.sh
#   ./scripts/set-google-oauth.sh 'your-secret'
#
# Prereqs: "shared" in ~/.ssh/config, repo on server at REPO_DIR.
#

set -e

GOOGLE_CLIENT_ID='772324541703-q8nbp99up6vu7ucoev5csrlr17c6c0so.apps.googleusercontent.com'
FRONTEND_URL='https://grooveray.com'
API_URL='https://grooveray.com'

# Client secret from env or first argument (never commit this)
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-${1}}"
if [[ -z "$GOOGLE_CLIENT_SECRET" ]]; then
  echo "Usage: GOOGLE_CLIENT_SECRET='...' ./scripts/set-google-oauth.sh"
  echo "   or: ./scripts/set-google-oauth.sh 'your-client-secret'"
  exit 1
fi

SSH_HOST="${SSH_HOST:-shared}"
REMOTE_REPO_DEFAULT='~/GrooveRay'
REPO_DIR="${REPO_DIR:-$REMOTE_REPO_DEFAULT}"

echo "Setting Google OAuth vars on $SSH_HOST (backend/.env) ..."
echo ""

ssh "$SSH_HOST" "bash -s" -- "$REPO_DIR" "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" "$FRONTEND_URL" "$API_URL" << 'REMOTE'
set -e
REPO_DIR="${1:?}"
GOOGLE_CLIENT_ID="${2:?}"
GOOGLE_CLIENT_SECRET="${3:?}"
FRONTEND_URL="${4:?}"
API_URL="${5:?}"
[[ "$REPO_DIR" == ~* ]] && REPO_DIR="$HOME${REPO_DIR:1}"

ENV_FILE="$REPO_DIR/backend/.env"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

# Remove existing Google OAuth lines (if any), keep the rest of .env
if [[ -f "$ENV_FILE" ]]; then
  tmp=$(mktemp)
  grep -v -e '^GOOGLE_CLIENT_ID=' -e '^GOOGLE_CLIENT_SECRET=' -e '^FRONTEND_URL=' -e '^API_URL=' "$ENV_FILE" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$ENV_FILE"
fi

# Append new values
echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> "$ENV_FILE"
echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" >> "$ENV_FILE"
echo "FRONTEND_URL=$FRONTEND_URL" >> "$ENV_FILE"
echo "API_URL=$API_URL" >> "$ENV_FILE"

# PM2 needs to load .env from backend dir or we pass via ecosystem; restart so it picks up new env
if [[ -f /opt/bitnami/scripts/setenv.sh ]]; then
  source /opt/bitnami/scripts/setenv.sh
fi
for node_dir in /opt/bitnami/node/bin /opt/bitnami/nodejs/bin; do
  [[ -x "$node_dir/pm2" ]] && export PATH="$node_dir:$PATH" && break
done

cd "$REPO_DIR"
pm2 restart grooveray
pm2 save

echo "Done. Updated $ENV_FILE and restarted grooveray."
REMOTE

echo "  ✓ Google OAuth vars set and PM2 restarted."
echo ""
