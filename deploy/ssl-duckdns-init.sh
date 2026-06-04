#!/usr/bin/env bash
# Obtain Let's Encrypt cert for APP_DOMAIN (DuckDNS), then enable HTTPS nginx config.
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Run from repo root with .env present"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

EMAIL="${SSL_EMAIL:-}"
if [[ -z "$EMAIL" ]]; then
  read -r -p "Email for Let's Encrypt: " EMAIL
fi

mkdir -p deploy/certbot/www deploy/certbot/conf deploy/nginx/generated

echo "Stopping nginx to free port 80..."
docker compose -f docker-compose.duckdns.yml stop nginx 2>/dev/null || true
docker compose -f docker-compose.ip.yml stop frontend 2>/dev/null || true

echo "Requesting certificate for ${APP_DOMAIN}..."
docker run --rm \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --agree-tos -m "$EMAIL" \
  -d "$APP_DOMAIN"

envsubst '${APP_DOMAIN}' < deploy/nginx/duckdns-https.conf.template > deploy/nginx/generated/default.conf

echo ""
echo "Update .env to HTTPS (if not already):"
echo "  PUBLIC_APP_URL=https://${APP_DOMAIN}"
echo "  PUBLIC_API_URL=https://${APP_DOMAIN}/api"
echo "  CORS_ORIGINS=https://${APP_DOMAIN}"
echo ""
echo "Add https://${APP_DOMAIN} to Google OAuth → Authorized JavaScript origins"
echo ""
echo "Then rebuild:"
echo "  docker compose -f docker-compose.duckdns.yml --env-file .env up -d --build"
