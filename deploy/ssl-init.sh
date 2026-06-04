#!/usr/bin/env bash
# Obtain Let's Encrypt certs, then switch nginx to HTTPS config.
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

docker compose -f docker-compose.prod.yml stop nginx

docker run --rm \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --agree-tos -m "$EMAIL" \
  -d "$APP_DOMAIN" \
  -d "$API_DOMAIN"

envsubst '${APP_DOMAIN} ${API_DOMAIN}' < deploy/nginx/app.conf.template > deploy/nginx/generated/default.conf

docker compose -f docker-compose.prod.yml up -d

echo "HTTPS enabled. Rebuild frontend if you started on HTTP:"
echo "  Set PUBLIC_API_URL=https://... and CORS_ORIGINS=https://... in .env, then:"
echo "  docker compose -f docker-compose.prod.yml up -d --build frontend"
