#!/usr/bin/env bash
# Run on a fresh Ubuntu 24.04 DigitalOcean Droplet (as root or with sudo).
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/vitobet}"
HTTP_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --http-only) HTTP_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [--http-only]"
      echo "  --http-only  nginx on port 80 only (before SSL certs exist)"
      exit 0
      ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "Missing .env in $(pwd). Copy deploy/env.production.example to .env and edit it."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

for v in APP_DOMAIN API_DOMAIN PUBLIC_API_URL CORS_ORIGINS POSTGRES_PASSWORD SECRET_KEY CRON_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  if [[ -z "${!v:-}" ]]; then
    echo "Set $v in .env"
    exit 1
  fi
done

mkdir -p deploy/nginx/generated

if [[ "$HTTP_ONLY" == true ]]; then
  export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://${APP_DOMAIN}}"
  export PUBLIC_API_URL="${PUBLIC_API_URL:-http://${API_DOMAIN}}"
  envsubst '${APP_DOMAIN} ${API_DOMAIN}' < deploy/nginx/app-http-only.conf.template > deploy/nginx/generated/default.conf
else
  envsubst '${APP_DOMAIN} ${API_DOMAIN}' < deploy/nginx/app.conf.template > deploy/nginx/generated/default.conf
fi

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Done. App: ${PUBLIC_APP_URL:-https://${APP_DOMAIN}}  API: ${PUBLIC_API_URL:-https://${API_DOMAIN}}"
