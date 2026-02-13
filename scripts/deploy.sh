#!/usr/bin/env bash
#
# GrooveRay deploy script
# SSHs to the server (ssh shared), pulls latest code, installs deps, builds frontend, restarts PM2.
#
# Usage:
#   ./scripts/deploy.sh              # full deploy
#   REPO_DIR=/var/www/grooveray ./scripts/deploy.sh   # custom repo path on server
#
# Prereqs: "shared" in ~/.ssh/config, and repo cloned on the server at REPO_DIR.
#

set -e

SSH_HOST="${SSH_HOST:-shared}"
REPO_DIR="${REPO_DIR:-$HOME/GrooveRay}"

echo ""
echo "  ╭─────────────────────────────────────────╮"
echo "  │  GrooveRay deploy → $SSH_HOST"
echo "  ╰─────────────────────────────────────────╯"
echo ""

ssh "$SSH_HOST" "bash -s" -- "$REPO_DIR" << 'REMOTE'
set -e
REPO_DIR="${1:?Missing REPO_DIR}"

echo "→ cd $REPO_DIR"
cd "$REPO_DIR"

echo "→ git pull"
git pull

echo "→ backend: npm install"
cd backend
npm install
cd ..

echo "→ frontend: npm install && npm run build"
cd frontend
npm install
npm run build
cd ..

echo "→ pm2 restart grooveray"
pm2 restart grooveray

echo "→ pm2 save (persist process list)"
pm2 save

echo ""
echo "  ✓ Deploy finished. Check: pm2 logs grooveray"
echo ""
REMOTE

echo "  Done."
echo ""
