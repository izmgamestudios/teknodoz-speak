#!/usr/bin/env bash
# scripts/post-deploy.sh — runs on the server after files are synced (also usable with CloudPanel Git deploy)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.js --update-env
  pm2 save
else
  echo "pm2 not found: restart the Node.js site from CloudPanel (Sites > your site > Restart)."
fi
sleep 2
curl -fsS "http://127.0.0.1:${PORT:-3147}/api/health" && echo " <- health OK" || echo "health check failed"
