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
# Default repo path on the *server* (use ~/GrooveRay so it works on the remote machine)
REMOTE_REPO_DEFAULT='~/GrooveRay'
REPO_DIR="${REPO_DIR:-$REMOTE_REPO_DEFAULT}"

echo ""
echo "  ╭─────────────────────────────────────────╮"
echo "  │  GrooveRay deploy → $SSH_HOST"
echo "  ╰─────────────────────────────────────────╯"
echo ""

ssh "$SSH_HOST" "bash -s" -- "$REPO_DIR" << 'REMOTE'
set -e
REPO_DIR="${1:?Missing REPO_DIR}"
# Expand ~ to $HOME on the server
[[ "$REPO_DIR" == ~* ]] && REPO_DIR="$HOME${REPO_DIR:1}"

# Bitnami: non-interactive SSH does not load .bashrc, so node/npm/pm2 are not in PATH
if [[ -f /opt/bitnami/scripts/setenv.sh ]]; then
  source /opt/bitnami/scripts/setenv.sh
fi
for node_dir in /opt/bitnami/node/bin /opt/bitnami/nodejs/bin; do
  if [[ -x "$node_dir/npm" ]]; then
    export PATH="$node_dir:$PATH"
    break
  fi
done

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
