from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.bet import Bet


def get_by_user_and_match(db: Session, user_id: uuid.UUID, match_id: uuid.UUID) -> Bet | None:
    return db.scalars(
        select(Bet).where(Bet.user_id == user_id, Bet.match_id == match_id)
    ).first()


def list_for_user(db: Session, user_id: uuid.UUID) -> list[Bet]:
    return list(
        db.scalars(
            select(Bet).options(joinedload(Bet.match)).where(Bet.user_id == user_id).order_by(Bet.updated_at.desc())
        ).unique()
        .all()
    )


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    match_id: uuid.UUID,
    prediction: str,
    created_at: datetime,
    updated_at: datetime,
    locked: bool,
    predicted_score_home: int | None = None,
    predicted_score_away: int | None = None,
) -> Bet:
    bet = Bet(
        id=uuid.uuid4(),
        user_id=user_id,
        match_id=match_id,
        prediction=prediction,
        created_at=created_at,
        updated_at=updated_at,
        locked=locked,
        resolved=False,
        points_awarded=None,
        predicted_score_home=predicted_score_home,
        predicted_score_away=predicted_score_away,
    )
    db.add(bet)
    db.flush()
    return bet
