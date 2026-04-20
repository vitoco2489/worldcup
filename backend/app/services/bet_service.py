from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.repositories import bet_repo, match_repo
from app.schemas.bet import BetPublic
from app.utils.time import get_current_time, is_bet_editable

CORRECT_POINTS = 3
EXACT_SCORE_BONUS = 2


def match_result_prediction(match: Match) -> str | None:
    if match.score_home is None or match.score_away is None:
        return None
    if match.score_home > match.score_away:
        return "home"
    if match.score_home < match.score_away:
        return "away"
    return "draw"


def is_exact_score_hit(bet: Bet, match: Match) -> bool:
    return _exact_score_match(bet, match)


def _exact_score_match(bet: Bet, match: Match) -> bool:
    if bet.predicted_score_home is None or bet.predicted_score_away is None:
        return False
    if match.score_home is None or match.score_away is None:
        return False
    return (
        bet.predicted_score_home == match.score_home and bet.predicted_score_away == match.score_away
    )


def resolve_bet(bet: Bet, match: Match, *, now: datetime | None = None) -> bool:
    """Idempotent: if already resolved, no-op. Returns True if resolution was applied or already done."""
    if bet.resolved:
        return True
    if match.status != "finished":
        return False
    outcome = match_result_prediction(match)
    if outcome is None:
        return False
    outcome_points = CORRECT_POINTS if bet.prediction == outcome else 0
    bonus = EXACT_SCORE_BONUS if _exact_score_match(bet, match) else 0
    bet.points_awarded = outcome_points + bonus
    bet.resolved = True
    bet.locked = True
    return True


def ensure_bet_lock_state(bet: Bet, match: Match, *, db: Session, now: datetime | None = None) -> None:
    n = now if now is not None else get_current_time(db=db)
    if bet.locked:
        return
    if not is_bet_editable(match.start_time, now=n):
        bet.locked = True


def bet_to_public(bet: Bet, match: Match, *, db: Session) -> BetPublic:
    now = get_current_time(db=db)
    ensure_bet_lock_state(bet, match, db=db, now=now)
    can_edit = is_bet_editable(match.start_time, now=now) and not bet.locked and not bet.resolved
    correct: bool | None = None
    exact_score_hit: bool | None = None
    if bet.resolved and match.status == "finished" and match.score_home is not None:
        outcome = match_result_prediction(match)
        if outcome is not None:
            correct = bet.prediction == outcome
        exact_score_hit = is_exact_score_hit(bet, match)
    return BetPublic(
        id=bet.id,
        user_id=bet.user_id,
        match_id=bet.match_id,
        prediction=bet.prediction,
        created_at=bet.created_at,
        updated_at=bet.updated_at,
        locked=not can_edit,
        resolved=bet.resolved,
        points_awarded=bet.points_awarded,
        predicted_score_home=bet.predicted_score_home,
        predicted_score_away=bet.predicted_score_away,
        editable=can_edit,
        correct=correct,
        exact_score_hit=exact_score_hit,
    )


def create_or_update_bet(
    db: Session,
    *,
    user_id: uuid.UUID,
    match_id: uuid.UUID,
    prediction: str,
    predicted_score_home: int | None = None,
    predicted_score_away: int | None = None,
) -> BetPublic:
    now = get_current_time(db=db)
    match = match_repo.get_by_id(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not is_bet_editable(match.start_time, now=now):
        raise HTTPException(status_code=400, detail="Betting is locked for this match")
    if (predicted_score_home is None) ^ (predicted_score_away is None):
        raise HTTPException(status_code=400, detail="Provide both predicted scores or omit both")
    if predicted_score_home is not None:
        if predicted_score_away is None or predicted_score_home < 0 or predicted_score_away < 0:
            raise HTTPException(status_code=400, detail="Scores must be non-negative integers")

    existing = bet_repo.get_by_user_and_match(db, user_id, match_id)
    if existing:
        if existing.locked or existing.resolved:
            raise HTTPException(status_code=400, detail="Bet is locked")
        if not is_bet_editable(match.start_time, now=now):
            raise HTTPException(status_code=400, detail="Betting is locked for this match")
        existing.prediction = prediction
        existing.predicted_score_home = predicted_score_home
        existing.predicted_score_away = predicted_score_away
        existing.updated_at = now
        existing.locked = False
        db.flush()
        return bet_to_public(existing, match, db=db)
    locked = not is_bet_editable(match.start_time, now=now)
    bet = bet_repo.create(
        db,
        user_id=user_id,
        match_id=match_id,
        prediction=prediction,
        created_at=now,
        updated_at=now,
        locked=locked,
        predicted_score_home=predicted_score_home,
        predicted_score_away=predicted_score_away,
    )
    db.flush()
    return bet_to_public(bet, match, db=db)
