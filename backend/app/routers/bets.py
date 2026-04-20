from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.models.bet import Bet
from app.schemas.bet import BetCreate, BetPublic
from app.services import bet_service

router = APIRouter(prefix="/bets", tags=["bets"])


@router.get("", response_model=list[BetPublic])
def my_bets(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    bets = db.scalars(
        select(Bet).options(joinedload(Bet.match)).where(Bet.user_id == user_id).order_by(Bet.updated_at.desc())
    ).unique().all()
    return [bet_service.bet_to_public(b, b.match, db=db) for b in bets]


@router.post("", response_model=BetPublic)
def upsert_bet(
    body: BetCreate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    out = bet_service.create_or_update_bet(
        db,
        user_id=user_id,
        match_id=body.match_id,
        prediction=body.prediction,
        predicted_score_home=body.predicted_score_home,
        predicted_score_away=body.predicted_score_away,
    )
    db.commit()
    return out
