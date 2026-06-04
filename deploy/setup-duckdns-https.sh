#!/usr/bin/env bash
# DuckDNS stack with nginx. Use --http-only first, then ./deploy/ssl-duckdns-init.sh
set -euo pipefail

HTTP_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --http-only) HTTP_ONLY=true ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "Copy deploy/env.ip-only.example to .env and set DuckDNS + HTTPS URLs (see deploy/DUCKDNS-HTTPS.md)."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${APP_DOMAIN:-}" ]]; then
  echo "Set APP_DOMAIN=vitobet.duckdns.org in .env"
  exit 1
fi

mkdir -p deploy/nginx/generated deploy/certbot/www deploy/certbot/conf

if [[ "$HTTP_ONLY" == true ]]; then
  envsubst '${APP_DOMAIN}' < deploy/nginx/duckdns-http.conf.template > deploy/nginx/generated/default.conf
else
  if [[ ! -f "deploy/certbot/conf/live/${APP_DOMAIN}/fullchain.pem" ]]; then
    echo "No cert yet. Run: ./deploy/setup-duckdns-https.sh --http-only"
    echo "Then:    ./deploy/ssl-duckdns-init.sh"
    exit 1
  fi
  envsubst '${APP_DOMAIN}' < deploy/nginx/duckdns-https.conf.template > deploy/nginx/generated/default.conf
fi

echo "Starting DuckDNS stack (nginx :80/:443, API at /api)..."
docker compose -f docker-compose.duckdns.yml --env-file .env up -d --build

echo "App:  ${PUBLIC_APP_URL:-https://${APP_DOMAIN}}"
echo "API:  ${PUBLIC_API_URL:-https://${APP_DOMAIN}/api}"
