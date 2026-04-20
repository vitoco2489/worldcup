from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.pool_settings import PoolSettings
from app.models.simulated_clock import SIMULATED_CLOCK_ROW_ID, SimulatedClock
from app.models.simulation_snapshot import SimulationBetSnapshot, SimulationMatchSnapshot
from app.repositories import match_repo
from app.services import simulation_service


def get_or_create_pool_settings(db: Session) -> PoolSettings:
    row = db.get(PoolSettings, 1)
    if row is None:
        row = PoolSettings(id=1, pool_total_usd=0)
        db.add(row)
        db.flush()
    return row


def set_pool_total_usd(db: Session, pool_total: int) -> PoolSettings:
    row = get_or_create_pool_settings(db)
    row.pool_total_usd = pool_total
    db.flush()
    return row


def simulate_match_result(
    db: Session,
    *,
    match_id: uuid.UUID,
    score_home: int,
    score_away: int,
    status: str,
) -> None:
    simulation_service.simulate_match_result(
        db,
        match_id=match_id,
        score_home=score_home,
        score_away=score_away,
        status=status,
    )


def force_lock_bets_for_match(db: Session, match_id: uuid.UUID) -> int:
    if not match_repo.get_by_id(db, match_id):
        raise HTTPException(status_code=404, detail="Match not found")
    bets = db.scalars(select(Bet).where(Bet.match_id == match_id)).all()
    n = 0
    for bet in bets:
        if not bet.locked:
            n += 1
        bet.locked = True
    db.flush()
    return n


def reset_all_data(db: Session) -> dict[str, int]:
    bets = db.scalars(select(Bet)).all()
    bets_deleted = len(bets)
    for b in bets:
        db.delete(b)

    matches = db.scalars(select(Match)).all()
    for m in matches:
        m.score_home = None
        m.score_away = None
        m.status = "scheduled"
    matches_reset = len(matches)

    sim_bet_snaps = db.scalars(select(SimulationBetSnapshot)).all()
    sim_match_snaps = db.scalars(select(SimulationMatchSnapshot)).all()
    snapshots_deleted = len(sim_bet_snaps) + len(sim_match_snaps)
    for s in sim_bet_snaps:
        db.delete(s)
    for s in sim_match_snaps:
        db.delete(s)

    clock = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
    if clock is not None:
        clock.simulated_at = None

    db.flush()
    return {
        "bets_deleted": bets_deleted,
        "matches_reset": matches_reset,
        "simulation_snapshots_deleted": snapshots_deleted,
    }


def reset_bets_only(db: Session) -> dict[str, int]:
    bets = db.scalars(select(Bet)).all()
    bets_deleted = len(bets)
    for b in bets:
        db.delete(b)
    db.flush()
    return {"bets_deleted": bets_deleted}


def reset_matches(db: Session) -> dict[str, int]:
    """Hard-delete all bets + matches (test reset). Also clears simulation artifacts."""
    sim_bet_snaps = db.scalars(select(SimulationBetSnapshot)).all()
    sim_match_snaps = db.scalars(select(SimulationMatchSnapshot)).all()
    snapshots_deleted = len(sim_bet_snaps) + len(sim_match_snaps)
    for s in sim_bet_snaps:
        db.delete(s)
    for s in sim_match_snaps:
        db.delete(s)

    bets = db.scalars(select(Bet)).all()
    bets_deleted = len(bets)
    for b in bets:
        db.delete(b)

    matches = db.scalars(select(Match)).all()
    matches_deleted = len(matches)
    for m in matches:
        db.delete(m)

    clock = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
    if clock is not None:
        clock.simulated_at = None

    db.flush()
    return {
        "bets_deleted": bets_deleted,
        "matches_deleted": matches_deleted,
        "simulation_snapshots_deleted": snapshots_deleted,
    }


