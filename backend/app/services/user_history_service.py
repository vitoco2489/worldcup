from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.schemas.user_history import UserBetHistoryItem, UserBetHistoryPublic
from app.services.bet_service import is_exact_score_hit, match_result_prediction


def _bet_item(bet: Bet) -> UserBetHistoryItem:
    m = bet.match
    finished = m.score_home is not None and m.score_away is not None
    correct: bool | None = None
    exact: bool | None = None
    if bet.resolved and finished:
        outcome = match_result_prediction(m)
        if outcome is not None:
            correct = bet.prediction == outcome
        exact = is_exact_score_hit(bet, m)
    return UserBetHistoryItem(
        bet_id=bet.id,
        match_id=m.id,
        team_home=m.team_home,
        team_away=m.team_away,
        team_home_code=m.team_home_code,
        team_away_code=m.team_away_code,
        start_time=m.start_time,
        score_home=m.score_home,
        score_away=m.score_away,
        match_finished=finished,
        prediction=bet.prediction,
        predicted_score_home=bet.predicted_score_home,
        predicted_score_away=bet.predicted_score_away,
        resolved=bet.resolved,
        points_awarded=bet.points_awarded,
        correct=correct,
        exact_score_hit=exact,
    )


def user_bet_history(db: Session, user_id: uuid.UUID) -> UserBetHistoryPublic:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    bets = list(
        db.scalars(
            select(Bet)
            .join(Match, Bet.match_id == Match.id)
            .options(joinedload(Bet.match))
            .where(Bet.user_id == user_id)
            .order_by(Match.start_time.desc())
        ).unique().all()
    )

    resolved_items: list[UserBetHistoryItem] = []
    pending_items: list[UserBetHistoryItem] = []
    correct_predictions = 0
    incorrect_predictions = 0
    exact_score_hits = 0

    for bet in bets:
        item = _bet_item(bet)
        if bet.resolved and item.match_finished:
            resolved_items.append(item)
            if item.correct is True:
                correct_predictions += 1
            elif item.correct is False:
                incorrect_predictions += 1
            if item.exact_score_hit:
                exact_score_hits += 1
        else:
            pending_items.append(item)

    total_points = (
        db.scalar(
            select(func.coalesce(func.sum(Bet.points_awarded), 0)).where(
                Bet.user_id == user_id,
                Bet.resolved.is_(True),
            )
        )
        or 0
    )

    return UserBetHistoryPublic(
        user_id=user.id,
        name=user.name,
        total_points=int(total_points),
        correct_predictions=correct_predictions,
        incorrect_predictions=incorrect_predictions,
        exact_score_hits=exact_score_hits,
        total_bets=len(bets),
        resolved=resolved_items,
        pending=pending_items,
    )
