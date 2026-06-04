#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Copy deploy/env.ip-only.example to .env and edit secrets first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "Starting IP-only stack (app :80, API :8000)..."
docker compose -f docker-compose.ip.yml up -d --build

echo "App:    ${PUBLIC_APP_URL:-http://${APP_DOMAIN}}"
echo "API:    ${PUBLIC_API_URL:-http://${APP_DOMAIN}:8000}"
echo "Health: ${PUBLIC_API_URL:-http://${APP_DOMAIN}:8000}/health"
