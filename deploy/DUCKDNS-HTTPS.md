# HTTPS en DuckDNS (vitobet)

Los celulares **siempre intentan abrir links con `https://`**. Si el servidor solo tiene HTTP, la página no carga. **No se puede desactivar eso en el teléfono** — hay que poner certificado SSL en el servidor.

## Qué compartir con amigos

Después de activar HTTPS:

```
https://vitobet.duckdns.org
```

Funciona en celular y PC. No uses `:8000` en el link del navegador.

## Migración desde `docker-compose.ip.yml`

En el Droplet:

```bash
cd /opt/vitobet
git pull

# 1) Editar .env — URLs HTTPS y API bajo /api
nano .env
```

```env
APP_DOMAIN=vitobet.duckdns.org

PUBLIC_APP_URL=https://vitobet.duckdns.org
PUBLIC_API_URL=https://vitobet.duckdns.org/api
CORS_ORIGINS=https://vitobet.duckdns.org
```

```bash
# 2) Apagar el stack viejo (libera puerto 80)
docker compose -f docker-compose.ip.yml down

# 3) Levantar nginx en HTTP (bootstrap)
chmod +x deploy/setup-duckdns-https.sh deploy/ssl-duckdns-init.sh
./deploy/setup-duckdns-https.sh --http-only

# 4) Certificado Let's Encrypt (gratis)
./deploy/ssl-duckdns-init.sh

# 5) Rebuild con URLs HTTPS
docker compose -f docker-compose.duckdns.yml --env-file .env up -d --build
```

## Google OAuth

En [Google Cloud Console](https://console.cloud.google.com/) → Credentials → tu cliente OAuth:

- **Authorized JavaScript origins:** `https://vitobet.duckdns.org` (quita `http://` si ya no lo usas)

## Renovar certificado (cada ~90 días)

```bash
docker compose -f docker-compose.duckdns.yml stop nginx
docker run --rm \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -p 80:80 certbot/certbot renew
docker compose -f docker-compose.duckdns.yml start nginx
```

## Mientras no tengas HTTPS

Comparte el link **con `http://` explícito**:

```
http://vitobet.duckdns.org
```

En muchos celulares igual lo cambian a HTTPS y fallará hasta que completes los pasos de arriba.
