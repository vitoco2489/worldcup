from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.simulation_snapshot import SimulationBetSnapshot, SimulationMatchSnapshot
from app.models.user import User
from app.repositories import bet_repo, match_repo
from app.services import bet_service
from app.utils.betting_validation import implied_outcome_from_scores
from app.utils.time import get_current_time


def _snapshot_bet_row(db: Session, bet: Bet, *, is_new: bool) -> None:
    if db.get(SimulationBetSnapshot, bet.id):
        return
    db.add(
        SimulationBetSnapshot(
            bet_id=bet.id,
            is_new=is_new,
            resolved=bet.resolved,
            points_awarded=bet.points_awarded,
            locked=bet.locked,
            prediction=bet.prediction,
            predicted_score_home=bet.predicted_score_home,
            predicted_score_away=bet.predicted_score_away,
        )
    )


def ensure_bet_snapshotted(db: Session, bet: Bet) -> None:
    if db.get(SimulationBetSnapshot, bet.id):
        return
    _snapshot_bet_row(db, bet, is_new=False)


def ensure_match_and_bets_snapshotted(db: Session, match_id: uuid.UUID) -> Match:
    m = match_repo.get_by_id(db, match_id)
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if not db.get(SimulationMatchSnapshot, match_id):
        db.add(
            SimulationMatchSnapshot(
                match_id=m.id,
                score_home=m.score_home,
                score_away=m.score_away,
                status=m.status,
            )
        )
    bets = db.scalars(select(Bet).where(Bet.match_id == match_id)).all()
    for b in bets:
        ensure_bet_snapshotted(db, b)
    db.flush()
    return m


def _reopen_all_match_bets(db: Session, match_id: uuid.UUID) -> None:
    for b in db.scalars(select(Bet).where(Bet.match_id == match_id)).all():
        b.resolved = False
        b.points_awarded = None
        b.locked = False


def simulate_match_result(
    db: Session,
    *,
    match_id: uuid.UUID,
    score_home: int,
    score_away: int,
    status: str,
) -> None:
    ensure_match_and_bets_snapshotted(db, match_id)
    m = match_repo.get_by_id(db, match_id)
    assert m
    m.score_home = score_home
    m.score_away = score_away
    m.status = status
    db.flush()
    if status == "finished":
        _reopen_all_match_bets(db, match_id)
        db.flush()
        bets = db.scalars(select(Bet).where(Bet.match_id == match_id)).all()
        for bet in bets:
            bet_service.resolve_bet(bet, m)
    db.flush()


def simulate_bet_for_user(
    db: Session,
    *,
    user_id: uuid.UUID,
    match_id: uuid.UUID,
    score_home: int,
    score_away: int,
) -> Bet:
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    ensure_match_and_bets_snapshotted(db, match_id)
    m = match_repo.get_by_id(db, match_id)
    assert m
    now = get_current_time(db=db)
    outcome = implied_outcome_from_scores(score_home, score_away)
    existing = bet_repo.get_by_user_and_match(db, user_id, match_id)
    if existing:
        ensure_bet_snapshotted(db, existing)
        existing.prediction = outcome
        existing.predicted_score_home = score_home
        existing.predicted_score_away = score_away
        existing.updated_at = now
        bet = existing
    else:
        bet = bet_repo.create(
            db,
            user_id=user_id,
            match_id=match_id,
            prediction=outcome,
            created_at=now,
            updated_at=now,
            locked=False,
            predicted_score_home=score_home,
            predicted_score_away=score_away,
        )
        db.flush()
        _snapshot_bet_row(db, bet, is_new=True)
    m.score_home = score_home
    m.score_away = score_away
    m.status = "finished"
    db.flush()
    _reopen_all_match_bets(db, match_id)
    db.flush()
    bets = db.scalars(select(Bet).where(Bet.match_id == match_id)).all()
    for b in bets:
        bet_service.resolve_bet(b, m)
    db.flush()
    return bet


def reset_simulation(db: Session) -> dict:
    deleted_new = 0
    restored_bets = 0
    restored_matches = 0

    new_snaps = list(db.scalars(select(SimulationBetSnapshot).where(SimulationBetSnapshot.is_new.is_(True))).all())
    for snap in new_snaps:
        bid = snap.bet_id
        db.delete(snap)
        db.flush()
        b = db.get(Bet, bid)
        if b:
            db.delete(b)
            deleted_new += 1

    old_snaps = list(db.scalars(select(SimulationBetSnapshot).where(SimulationBetSnapshot.is_new.is_(False))).all())
    for snap in old_snaps:
        bet = db.get(Bet, snap.bet_id)
        if bet:
            bet.resolved = snap.resolved
            bet.points_awarded = snap.points_awarded
            bet.locked = snap.locked
            bet.prediction = snap.prediction
            bet.predicted_score_home = snap.predicted_score_home
            bet.predicted_score_away = snap.predicted_score_away
            restored_bets += 1
        db.delete(snap)

    match_snaps = list(db.scalars(select(SimulationMatchSnapshot)).all())
    for ms in match_snaps:
        m = db.get(Match, ms.match_id)
        if m:
            m.score_home = ms.score_home
            m.score_away = ms.score_away
            m.status = ms.status
            restored_matches += 1
        db.delete(ms)

    db.flush()
    return {
        "bets_deleted_new": deleted_new,
        "bets_restored": restored_bets,
        "matches_restored": restored_matches,
    }
