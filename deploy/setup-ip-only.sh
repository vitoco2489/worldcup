#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Copy deploy/env.ip-only.example to .env and edit secrets first."
  exit 1
fi

echo "Starting IP-only stack (app :80, API :8000)..."
docker compose -f docker-compose.ip.yml --env-file .env up -d --build

APP_URL=$(grep -E '^PUBLIC_APP_URL=' .env | cut -d= -f2- | tr -d '"')
API_URL=$(grep -E '^PUBLIC_API_URL=' .env | cut -d= -f2- | tr -d '"')
echo "App:    ${APP_URL:-see .env}"
echo "API:    ${API_URL:-see .env}"
echo "Health: ${API_URL:-}/health"
