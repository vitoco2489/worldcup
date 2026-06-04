# Deploy vitobet on DigitalOcean (single Droplet)

Run the full stack (Postgres + API + Next.js + nginx + cron) on one **$6–12/mo** Droplet with Docker.

## What you need

| Item | Notes |
|------|--------|
| **Droplet** | Ubuntu 24.04, **1 GB RAM minimum** (2 GB nicer for builds) |
| **Domain** | Strongly recommended for Google sign-in (two hostnames) |
| **Google OAuth** | Same Web client as local dev |

**DNS** (A records → Droplet public IP):

- `vitobet.example.com` → your app (frontend)
- `api.vitobet.example.com` → API (backend)

## 1. Create the Droplet

1. [DigitalOcean](https://www.digitalocean.com/) → **Create** → **Droplets**
2. **Ubuntu 24.04 LTS**, region near your users, **Basic** $6/mo (or $12 for 2 GB)
3. Authentication: **SSH key** (recommended) or password
4. Create and note the **public IP**

## 2. Point DNS

At your domain registrar, add **A records** for `APP_DOMAIN` and `API_DOMAIN` to the Droplet IP. Wait until they resolve (`dig vitobet.example.com`).

## 3. Install Docker on the server

```bash
ssh root@YOUR_DROPLET_IP
git clone https://github.com/vitoco2489/worldcup.git /opt/vitobet
cd /opt/vitobet
chmod +x deploy/*.sh
sudo ./deploy/install-docker.sh
```

## 4. Configure environment

```bash
cp deploy/env.production.example .env
nano .env
```

Set at least:

- `APP_DOMAIN`, `API_DOMAIN` — hostnames only (no `https://`)
- `PUBLIC_API_URL` — `https://api.yourdomain.com` (used when building the frontend)
- `CORS_ORIGINS` — `https://yourdomain.com` (exact frontend URL, no trailing `/`)
- `POSTGRES_PASSWORD`, `SECRET_KEY`, `CRON_SECRET` — long random strings
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

For the **first** deploy before SSL, you can use `http://` URLs in `PUBLIC_API_URL` and `CORS_ORIGINS`, then switch to `https://` after certs and **rebuild** the frontend.

## 5. First deploy (HTTP)

```bash
./deploy/setup-droplet.sh --http-only
```

Open:

- App: `http://APP_DOMAIN`
- API health: `http://API_DOMAIN/health`

## 6. Enable HTTPS (Let’s Encrypt)

When DNS works:

```bash
./deploy/ssl-init.sh
```

Update `.env` to **https** URLs for `PUBLIC_API_URL` and `CORS_ORIGINS`, then:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```

## 7. Google OAuth (production)

Google Cloud → your OAuth client → **Authorized JavaScript origins**:

- `https://APP_DOMAIN` (and `http://...` only while testing HTTP)

No NextAuth in this project — origins only, not redirect URIs.

## 8. Updates after `git pull`

```bash
cd /opt/vitobet
git pull
./deploy/setup-droplet.sh    # or --http-only if you have not enabled SSL yet
```

## Cost

- **~$6/month** Droplet + domain (~$10–15/year if you buy one)
- No Render card; you control the VM

## Firewall (recommended)

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Do **not** expose Postgres (5432) publicly.

## Troubleshooting

- **502 / nginx error**: `docker compose -f docker-compose.prod.yml logs nginx backend frontend`
- **Google login fails**: check `CORS_ORIGINS`, `PUBLIC_API_URL`, and Google origins match exactly
- **Cron**: internal service hits `http://backend:8000/jobs/run` every 15 minutes
