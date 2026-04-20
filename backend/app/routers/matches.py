from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.admin import FinishedMatchTable
from app.schemas.match import MatchAdminUpdate, MatchPublic
from app.services import match_service, results_service

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchPublic])
def list_matches(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return match_service.list_matches_public(db)


@router.get("/recent", response_model=list[MatchPublic])
def recent(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return match_service.list_recent(db)


@router.get("/upcoming", response_model=list[MatchPublic])
def upcoming(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return match_service.list_upcoming(db)


@router.get("/upcoming-without-bet", response_model=list[MatchPublic])
def upcoming_without_bet(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return match_service.list_upcoming_without_bet(db, user_id)


@router.get("/results-table", response_model=list[FinishedMatchTable])
def results_table(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    rows = results_service.list_finished_match_tables(db)
    return [FinishedMatchTable(**r) for r in rows]


@router.patch("/{match_id}", response_model=MatchPublic)
def admin_update_match(
    match_id: uuid.UUID,
    body: MatchAdminUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    user = require_user(db, user_id)
    try:
        m = match_service.admin_update_result(
            db,
            match_id=match_id,
            score_home=body.score_home,
            score_away=body.score_away,
            status=body.status,
            admin_email=user.email,
        )
    except HTTPException:
        raise
    db.commit()
    return m
