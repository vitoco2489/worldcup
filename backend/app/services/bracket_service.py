from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.schemas.community import PredictionCounts
from app.schemas.match import MatchPublic
from app.schemas.social import BracketMatchRow, BracketRound, BracketView
from app.services.match_service import to_public
from app.services.pick_stats import count_predictions, popular_prediction
from app.utils.time import get_current_time


def _round_sort_key(round_name: str | None) -> tuple[int, str]:
    if not round_name:
        return (90, "")
    r = round_name.lower()
    if "32" in r:
        return (1, round_name)
    if "16" in r:
        return (2, round_name)
    if "quarter" in r or "cuart" in r:
        return (3, round_name)
    if "semi" in r:
        return (4, round_name)
    if "third" in r or "3rd" in r or "tercer" in r:
        return (5, round_name)
    if "final" in r:
        return (6, round_name)
    return (50, round_name)


def bracket_view(db: Session) -> BracketView:
    now = get_current_time(db=db)
    rows = list(
        db.scalars(
            select(Match)
            .where(Match.group_name.is_(None))
            .order_by(Match.match_number.asc().nulls_last(), Match.start_time.asc())
        ).all()
    )

    by_round: dict[str, list[BracketMatchRow]] = {}
    for m in rows:
        round_label = m.round or "Eliminatoria"
        counts = count_predictions(db, m.id)
        pop, pct = popular_prediction(counts)
        total = counts["home"] + counts["draw"] + counts["away"]
        by_round.setdefault(round_label, []).append(
            BracketMatchRow(
                match=to_public(m, now=now),
                counts=PredictionCounts(**counts),
                popular_prediction=pop,
                popular_pct=pct,
                bet_count=total,
            )
        )

    rounds = [
        BracketRound(round=label, matches=by_round[label])
        for label in sorted(by_round.keys(), key=_round_sort_key)
    ]
    return BracketView(rounds=rounds)
