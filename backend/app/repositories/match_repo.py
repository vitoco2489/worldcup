from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match


def get_by_id(db: Session, match_id: uuid.UUID) -> Match | None:
    return db.get(Match, match_id)


def list_all(db: Session) -> list[Match]:
    return list(db.scalars(select(Match).order_by(Match.start_time.asc())).all())


def list_recent(db: Session, *, now: datetime, limit: int = 20) -> list[Match]:
    """Dashboard: same as upcoming — no scores, kickoff in the future (not finished/past)."""
    return list_upcoming(db, now=now, limit=limit)


def list_upcoming(db: Session, *, now: datetime, limit: int = 50) -> list[Match]:
    return list(
        db.scalars(
            select(Match)
            .where(
                Match.score_home.is_(None),
                Match.score_away.is_(None),
                Match.start_time > now,
                Match.teams_resolved.is_(True),
            )
            .order_by(Match.start_time.asc())
            .limit(limit)
        ).all()
    )
