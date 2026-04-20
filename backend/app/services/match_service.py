from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.repositories import bet_repo, match_repo
from app.schemas.match import MatchPublic
from app.services import bet_service
from app.utils.admin import is_admin_email
from app.utils.time import get_current_time, lock_time_for_match_start


def derived_match_status(match: Match, *, now) -> str:
    """Status is data/time-derived from scores and kickoff windows."""
    if match.score_home is not None and match.score_away is not None:
        return "finished"
    if now >= match.start_time:
        return "in_progress"
    if now >= lock_time_for_match_start(match.start_time):
        return "locked"
    return "scheduled"


def to_public(match: Match, *, now) -> MatchPublic:
    return MatchPublic(
        id=match.id,
        team_home=match.team_home,
        team_away=match.team_away,
        team_home_code=match.team_home_code,
        team_away_code=match.team_away_code,
        start_time=match.start_time,
        score_home=match.score_home,
        score_away=match.score_away,
        status=derived_match_status(match, now=now),
    )


def list_matches_public(db: Session) -> list[MatchPublic]:
    rows = match_repo.list_all(db)
    now = get_current_time(db=db)
    return [to_public(m, now=now) for m in rows]


def list_recent(db: Session, limit: int = 20) -> list[MatchPublic]:
    now = get_current_time(db=db)
    rows = match_repo.list_recent(db, now=now, limit=limit)
    return [to_public(m, now=now) for m in rows]


def list_upcoming(db: Session, limit: int = 50) -> list[MatchPublic]:
    now = get_current_time(db=db)
    rows = match_repo.list_upcoming(db, now=now, limit=limit)
    return [to_public(m, now=now) for m in rows]


def list_upcoming_without_bet(db: Session, user_id: uuid.UUID) -> list[MatchPublic]:
    now = get_current_time(db=db)
    upcoming = match_repo.list_upcoming(db, now=now, limit=100)
    out: list[MatchPublic] = []
    for m in upcoming:
        if bet_repo.get_by_user_and_match(db, user_id, m.id) is None:
            out.append(to_public(m, now=now))
    return out


def set_result_and_resolve(
    db: Session,
    *,
    match_id: uuid.UUID,
    score_home: int,
    score_away: int,
) -> MatchPublic:
    if score_home < 0 or score_away < 0:
        raise HTTPException(status_code=400, detail="Scores must be non-negative integers")
    m = match_repo.get_by_id(db, match_id)
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    m.score_home = score_home
    m.score_away = score_away
    m.status = "finished"
    for bet in db.scalars(select(Bet).where(Bet.match_id == match_id)).all():
        bet_service.resolve_bet(bet, m)
    db.flush()
    return to_public(m, now=get_current_time(db=db))


def admin_update_result(
    db: Session,
    *,
    match_id: uuid.UUID,
    score_home: int,
    score_away: int,
    status: str,
    admin_email: str,
) -> MatchPublic:
    if not is_admin_email(admin_email):
        raise HTTPException(status_code=403, detail="Not allowed to update matches")
    return set_result_and_resolve(
        db,
        match_id=match_id,
        score_home=score_home,
        score_away=score_away,
    )
