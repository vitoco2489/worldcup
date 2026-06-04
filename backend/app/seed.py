from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.match import Match

SEED_MATCHES: list[dict] = []


def seed_matches_if_empty(db: Session) -> int:
    count = db.scalar(select(func.count()).select_from(Match)) or 0
    if count > 0:
        return 0
    inserted = 0
    for row in SEED_MATCHES:
        m = Match(
            id=uuid.uuid4(),
            team_home=row["team_home"],
            team_away=row["team_away"],
            team_home_code=row["team_home_code"],
            team_away_code=row["team_away_code"],
            start_time=row["start_time"],
            score_home=None,
            score_away=None,
            status="scheduled",
        )
        db.add(m)
        inserted += 1
    db.flush()
    return inserted
