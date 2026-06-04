from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.user import User


def count_predictions(db: Session, match_id) -> dict[str, int]:
    stmt = select(Bet.prediction, func.count()).where(Bet.match_id == match_id).group_by(Bet.prediction)
    rows = {r[0]: int(r[1]) for r in db.execute(stmt).all()}
    return {
        "home": rows.get("home", 0),
        "draw": rows.get("draw", 0),
        "away": rows.get("away", 0),
    }


def names_by_prediction(db: Session, match_id) -> dict[str, list[str]]:
    stmt = select(Bet.prediction, User.name).join(User, User.id == Bet.user_id).where(Bet.match_id == match_id)
    buckets: dict[str, set[str]] = {"home": set(), "draw": set(), "away": set()}
    for pred, name in db.execute(stmt).all():
        if pred in buckets:
            buckets[pred].add(name)
    return {k: sorted(v) for k, v in buckets.items()}


def sole_picker(db: Session, match_id, prediction: str) -> str | None:
    names = names_by_prediction(db, match_id).get(prediction, [])
    return names[0] if len(names) == 1 else None


def popular_prediction(counts: dict[str, int]) -> tuple[str | None, int]:
    total = counts["home"] + counts["draw"] + counts["away"]
    if total == 0:
        return None, 0
    best = max(("home", "draw", "away"), key=lambda k: counts[k])
    pct = round(counts[best] / total * 100)
    return best, pct
