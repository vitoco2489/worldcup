from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.social import BracketView, DailyDigest, WallHighlights
from app.services import bracket_service, digest_service, wall_service
from app.utils.chile_time import chile_today_key
from app.utils.time import get_current_time

router = APIRouter(tags=["social"])


@router.get("/digest/daily", response_model=DailyDigest)
def daily_digest(
    date: str | None = Query(None, description="YYYY-MM-DD in Chile"),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    key = date or chile_today_key(get_current_time(db=db))
    return digest_service.daily_digest(db, key)


@router.get("/bracket", response_model=BracketView)
def bracket(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return bracket_service.bracket_view(db)


@router.get("/wall/highlights", response_model=WallHighlights)
def wall(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return wall_service.wall_highlights(db)
