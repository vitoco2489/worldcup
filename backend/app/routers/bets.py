from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.models.bet import Bet
from app.models.match import Match
from app.schemas.bet import BetCreate, BetPublic, BetWithMatchPublic
from app.services import bet_service, match_service
from app.utils.time import get_current_time

router = APIRouter(prefix="/bets", tags=["bets"])


@router.get("", response_model=list[BetWithMatchPublic])
def my_bets(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    now = get_current_time(db=db)
    bets = db.scalars(
        select(Bet)
        .join(Match, Bet.match_id == Match.id)
        .options(joinedload(Bet.match))
        .where(Bet.user_id == user_id)
        .order_by(Match.start_time.asc())
    ).unique().all()
    out: list[BetWithMatchPublic] = []
    for b in bets:
        public = bet_service.bet_to_public(b, b.match, db=db)
        out.append(
            BetWithMatchPublic(
                **public.model_dump(),
                match=match_service.to_public(b.match, now=now),
            )
        )
    return out


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
