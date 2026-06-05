from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import engine, Base
import app.models  # noqa: F401 — register all ORM tables with Base.metadata
from app.routers import admin, auth, bets, community, jobs, leaderboard, matches, pool, profile, social, time_state
from app.seed import seed_matches_if_empty
from app.services.allowlist_service import seed_allowlist_if_empty

# Serialize DDL across Gunicorn workers (parallel lifespan would race on create_all).
_PG_BOOTSTRAP_LOCK_1 = 893_721
_PG_BOOTSTRAP_LOCK_2 = 104_729


def _bootstrap_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text("SELECT pg_advisory_lock(CAST(:a AS int), CAST(:b AS int))"),
            {"a": _PG_BOOTSTRAP_LOCK_1, "b": _PG_BOOTSTRAP_LOCK_2},
        )
        try:
            Base.metadata.create_all(bind=conn)
            conn.execute(text("ALTER TABLE bets ADD COLUMN IF NOT EXISTS predicted_score_home INTEGER"))
            conn.execute(text("ALTER TABLE bets ADD COLUMN IF NOT EXISTS predicted_score_away INTEGER"))
            conn.execute(text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS round VARCHAR(64)"))
            conn.execute(text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_name VARCHAR(32)"))
            conn.execute(text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS ground VARCHAR(128)"))
            conn.execute(text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_number INTEGER"))
            conn.execute(text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams_resolved BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS entry_paid BOOLEAN NOT NULL DEFAULT FALSE"))
            db = Session(bind=conn, close_resets_only=True)
            try:
                seed_allowlist_if_empty(db)
                seed_matches_if_empty(db)
            finally:
                db.close()
        finally:
            conn.execute(
                text("SELECT pg_advisory_unlock(CAST(:a AS int), CAST(:b AS int))"),
                {"a": _PG_BOOTSTRAP_LOCK_1, "b": _PG_BOOTSTRAP_LOCK_2},
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_db()
    yield


app = FastAPI(title="World Cup Pool API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(time_state.router)
app.include_router(admin.router)
app.include_router(community.router)
app.include_router(matches.router)
app.include_router(bets.router)
app.include_router(leaderboard.router)
app.include_router(pool.router)
app.include_router(profile.router)
app.include_router(social.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
