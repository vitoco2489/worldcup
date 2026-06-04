# World Cup Pool (MVP)

Private World Cup betting pool: FastAPI + PostgreSQL + Next.js, Docker for local dev, Render blueprint included.

## Quick start (Docker)

1. Create a Google OAuth **Web application** client in Google Cloud Console.
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: not required for the ID-token button flow used here.

2. Export credentials (or put them in a root `.env` file that Compose reads — see below):

   ```bash
   export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export GOOGLE_CLIENT_SECRET="your-secret"  # optional for this flow; still set for parity with prod
   ```

3. From the repo root:

   ```bash
   docker compose up --build
   ```

4. Open `http://localhost:3000`, sign in with Google, place picks.

- API: `http://localhost:8000`
- Health: `GET http://localhost:8000/health`

### Optional Compose env file

Create `.env` beside `docker-compose.yml`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CRON_SECRET=dev-cron-secret
```

Admin actions (`PATCH /matches/{id}`, `POST /admin/load-matches`) are allowed only for **vitoco2489@gmail.com** (see `backend/app/utils/admin.py`).

## Backend

- **Run command (production):** `gunicorn -k uvicorn.workers.UvicornWorker app.main:app`
- **Env vars:** `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SECRET_KEY`
- **Also supported:** `CORS_ORIGINS` (comma-separated), `CRON_SECRET` (if set, required on `POST /jobs/run` as header `X-Cron-Secret`), `PRIZE_POOL_LABEL`, `PRIZE_POOL_AMOUNT_USD`

### API (high level)

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/login` | Body: `{ "id_token": "<Google ID token>" }` → JWT |
| GET | `/auth/me` | Bearer |
| GET | `/matches`, `/matches/recent`, `/matches/upcoming` | — |
| GET | `/matches/upcoming-without-bet` | Bearer |
| PATCH | `/matches/{match_id}` | Bearer + admin (`vitoco2489@gmail.com`) |
| POST | `/admin/load-matches` | Bearer + admin — JSON array of matches; dedupes by teams + `start_time` |
| POST | `/admin/load-matches-csv` | Bearer + admin — `multipart/form-data` field `file` (CSV); returns `created`, `skipped`, `errors[]` |
| PUT | `/admin/pool` | Bearer + admin — `{"pool_total": 50000}` (whole USD); drives `/pool` display |
| POST | `/admin/simulate-match` | Bearer + admin — set result + resolve bets (idempotent for already-resolved rows) |
| POST | `/admin/lock-bets/{match_id}` | Bearer + admin — force `locked` on all bets for that match |
| GET | `/community` | — aggregated pick counts; names only after kickoff |
| GET | `/bets` | Bearer |
| POST | `/bets` | Bearer — upsert; optional scores (both or neither); must match outcome (see rules) |
| GET | `/leaderboard` | — |
| GET | `/pool` | — includes `pool_total_usd` and formatted `prize_display_usd` |
| GET | `/profile/stats` | Bearer — total points, correct 1×2 count, exact-score hits |
| POST | `/jobs/run` | Header `X-Cron-Secret` if `CRON_SECRET` is set |

All backend timestamps are stored in **UTC**. The UI shows **local** wall times.

### Rules

- One bet per user per match (`UNIQUE(user_id, match_id)`).
- Editable until **kickoff minus 5 minutes**; then locked (also enforced server-side).
- If both predicted scores are set, they must match the 1×2 pick: **home** ⇒ home goals **>** away; **away** ⇒ away **>** home; **draw** ⇒ equal.
- Correct outcome: **3** points; wrong outcome: **0** for that part.
- Exact predicted score (both goals correct): **+2** extra (even if outcome was wrong). Max **5** points per match.
- Resolution is **idempotent** via `resolved`.

### Maintenance job

Same logic as `POST /jobs/run`:

```bash
cd backend
PYTHONPATH=. python scripts/run_job.py
```

The job: advances `scheduled` → `live` after kickoff, locks overdue bets, resolves finished matches that have scores and `status=finished`.

### Seeding

On first boot, if `matches` is empty, the API inserts the row from `backend/data/seed_matches.json` (mirrored in `app/seed.py`). Adjust there for your pool.

### Admin: set a result

```bash
curl -X PATCH "http://localhost:8000/matches/<MATCH_UUID>" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"score_home":2,"score_away":1,"status":"finished"}'
```

You must be signed in as **vitoco2489@gmail.com**.

### Admin: bulk load matches

```bash
curl -X POST "http://localhost:8000/admin/load-matches" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '[{"team_home":"Chile","team_away":"Argentina","team_home_code":"cl","team_away_code":"ar","start_time":"2026-06-10T20:00:00Z"}]'
```

Response: `{"created": N, "skipped": M}` for new vs duplicate rows (same home, away, `start_time`).

CSV header: `team_home,team_away,team_home_code,team_away_code,start_time`

### Admin: testing (simulate / lock)

- **`POST /admin/simulate-match`** — body `{"match_id":"uuid","score_home":2,"score_away":1,"status":"finished"}` updates the match and runs the same resolution logic as the cron job (skips bets already `resolved`).
- **`POST /admin/lock-bets/{match_id}`** — sets `locked` on every bet for that match.

Use only in non-production or dedicated test data if you care about audit history.

## Frontend

- **Build:** `npm install && npm run build` (see `frontend/`)
- **Env:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

After a successful save, the UI plays a short **Framer Motion** “kick” animation (⚽) without blocking interaction.

**Profile** (`/profile`): stats, prize pool display, and an **Admin** panel (same Google account as backend admin) for pool amount, JSON/CSV match upload, simulate result, and force-lock bets.

## DigitalOcean (single Droplet, ~$6/mo)

See **[deploy/DIGITALOCEAN.md](deploy/DIGITALOCEAN.md)** for step-by-step: Docker on Ubuntu, `docker-compose.prod.yml`, nginx, Let’s Encrypt, and Google OAuth.

Quick start on the server:

```bash
git clone https://github.com/vitoco2489/worldcup.git /opt/vitobet && cd /opt/vitobet
cp deploy/env.production.example .env   # edit domains + secrets
chmod +x deploy/*.sh && ./deploy/install-docker.sh
./deploy/setup-droplet.sh --http-only   # then ./deploy/ssl-init.sh for HTTPS
```

## Render (vitobet)

Blueprint: `render.yaml` — **PostgreSQL** (`vitobet-db`), **API** (`vitobet-api`, Docker), **web** (`vitobet-web`, Node), **cron** (`vitobet-cron`).

### URLs and naming

Render service names are **globally unique**. Do not assume `vitobet.onrender.com` exists; the blueprint uses **`vitobet-web`** and **`vitobet-api`** so typical URLs are:

- Frontend: `https://vitobet-web.onrender.com`
- Backend: `https://vitobet-api.onrender.com`

If a name is taken, rename services in the dashboard or edit `render.yaml` before the first deploy (e.g. `vitobet-pool-web`, `vitobet-2026-api`, `vitobet-cl-web`).

### Frontend environment

- **`NEXT_PUBLIC_API_URL`** — must be the **public HTTPS base URL of the API** (no trailing slash). The blueprint sets this from the backend service’s `RENDER_EXTERNAL_URL`; you can override in the Render UI if needed.
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** — same value as backend `GOOGLE_CLIENT_ID`.

This project does **not** use NextAuth. You do **not** need `NEXTAUTH_URL` unless you add NextAuth yourself.

### Backend environment

- **`CORS_ORIGINS`** — comma-separated list of **exact** frontend origins (scheme + host + port if any), **no trailing slash**. Include every URL users open, for example:

  `https://vitobet-web.onrender.com,https://www.vitobet.cl`

  After you add a **custom domain** on the frontend service, add that origin here too and redeploy the API (or let it pick up the new env).

### Google OAuth (production)

In Google Cloud Console → **Credentials** → your **Web application** client:

- **Authorized JavaScript origins**: add each frontend URL you use, e.g. `https://vitobet-web.onrender.com`, `https://vitobet.cl`, `https://www.vitobet.cl`.
- Sign-in uses the Google Identity Services button flow (ID token to `/auth/login`), not a NextAuth callback. You only need **`/api/auth/callback/google`** redirect URIs if you introduce NextAuth later.

Use **HTTPS** only in production.

### Custom domain (optional)

1. Buy the domain (e.g. Namecheap).
2. Render → **vitobet-web** → **Custom Domains** → add `vitobet.cl`, `www.vitobet.cl`, etc.
3. DNS (examples):
   - **www** → **CNAME** → `vitobet-web.onrender.com` (or the hostname Render shows).
   - **apex (@)** → Render usually provides **A/ALIAS** records; follow the dashboard instructions.
4. SSL is automatic on Render once DNS verifies.
5. Update **`CORS_ORIGINS`** and **Google JavaScript origins** with the new URLs.

### First deploy checklist

Set **sync: false** vars in the Render dashboard: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CORS_ORIGINS`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

If the cron job cannot inherit `CRON_SECRET` from the backend, copy the backend’s `CRON_SECRET` into the cron service manually.

## Flag images

Team flags use `https://flagcdn.com/w40/{code}.png` (for example `cl`, `ar`).
