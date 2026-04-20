from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.schemas.community import CommunityMatchRow, PredictionCounts
from app.schemas.match import MatchPublic
from app.utils.time import get_current_time


def _count_predictions(db: Session, match_id) -> dict[str, int]:
    stmt = select(Bet.prediction, func.count()).where(Bet.match_id == match_id).group_by(Bet.prediction)
    rows = {r[0]: int(r[1]) for r in db.execute(stmt).all()}
    return {
        "home": rows.get("home", 0),
        "draw": rows.get("draw", 0),
        "away": rows.get("away", 0),
    }


def _names_by_prediction(db: Session, match_id) -> dict[str, list[str]]:
    stmt = select(Bet.prediction, User.name).join(User, User.id == Bet.user_id).where(Bet.match_id == match_id)
    buckets: dict[str, set[str]] = {"home": set(), "draw": set(), "away": set()}
    for pred, name in db.execute(stmt).all():
        if pred in buckets:
            buckets[pred].add(name)
    return {k: sorted(v) for k, v in buckets.items()}


def community_overview(db: Session) -> list[CommunityMatchRow]:
    match_ids = list(db.scalars(select(Bet.match_id).distinct()).all())
    if not match_ids:
        return []
    now = get_current_time(db=db)
    rows: list[CommunityMatchRow] = []
    for mid in match_ids:
        m = db.get(Match, mid)
        if not m:
            continue
        counts = _count_predictions(db, mid)
        reveal = now >= m.start_time
        individuals = _names_by_prediction(db, mid) if reveal else None
        rows.append(
            CommunityMatchRow(
                match=MatchPublic.model_validate(m),
                counts=PredictionCounts(**counts),
                reveal_individuals=reveal,
                individuals=individuals,
            )
        )
    rows.sort(key=lambda r: r.match.start_time)
    return rows
