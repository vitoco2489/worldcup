from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.bet import Bet
from app.schemas.profile import UserStatsPublic
from app.services.bet_service import is_exact_score_hit, match_result_prediction


def user_stats(db: Session, user_id: uuid.UUID) -> UserStatsPublic:
    total_points = (
        db.scalar(
            select(func.coalesce(func.sum(Bet.points_awarded), 0)).where(
                Bet.user_id == user_id,
                Bet.resolved.is_(True),
            )
        )
        or 0
    )

    bets = db.scalars(
        select(Bet)
        .options(joinedload(Bet.match))
        .where(Bet.user_id == user_id, Bet.resolved.is_(True))
    ).unique().all()

    correct_predictions = 0
    exact_score_hits = 0
    for bet in bets:
        m = bet.match
        if m.status != "finished":
            continue
        outcome = match_result_prediction(m)
        if outcome is not None and bet.prediction == outcome:
            correct_predictions += 1
        if is_exact_score_hit(bet, m):
            exact_score_hits += 1

    return UserStatsPublic(
        total_points=int(total_points),
        correct_predictions=correct_predictions,
        exact_score_hits=exact_score_hits,
    )
