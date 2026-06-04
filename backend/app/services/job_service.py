from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.bet import Bet
from app.repositories import match_repo
from app.services.bet_service import resolve_bet, ensure_bet_lock_state
from app.services import bracket_resolver_service
from app.utils.time import get_current_time


def sync_match_statuses(db: Session, *, now=None) -> int:
    """Mark scheduled matches as live once kickoff passes (finish + scores via admin)."""
    n = now or get_current_time(db=db)
    updated = 0
    for m in match_repo.list_all(db):
        if m.status == "scheduled" and m.start_time <= n:
            m.status = "live"
            updated += 1
    return updated


def lock_due_bets(db: Session, *, now=None) -> int:
    n = now or get_current_time(db=db)
    bets = db.scalars(select(Bet).options(joinedload(Bet.match))).all()
    count = 0
    for bet in bets:
        if bet.resolved:
            continue
        match = bet.match
        before = bet.locked
        ensure_bet_lock_state(bet, match, db=db, now=n)
        if bet.locked and not before:
            count += 1
    return count


def resolve_all_pending_bets(db: Session) -> int:
    """Idempotent: only unresolved bets on finished matches with scores."""
    count = 0
    stmt = select(Bet).options(joinedload(Bet.match)).where(Bet.resolved.is_(False))
    for bet in db.scalars(stmt).unique().all():
        if resolve_bet(bet, bet.match):
            count += 1
    return count


def run_maintenance_job(db: Session) -> dict:
    """
    Idempotent job: sync statuses, lock bets past cutoff, resolve finished matches.
    """
    try:
        status_updates = sync_match_statuses(db)
        locked = lock_due_bets(db)
        resolved = resolve_all_pending_bets(db)
        bracket_updated = bracket_resolver_service.refresh_bracket(db)
        db.commit()
        return {
            "match_status_updates": status_updates,
            "bets_newly_locked": locked,
            "bets_resolved": resolved,
            "bracket_slots_updated": bracket_updated,
        }
    except Exception:
        db.rollback()
        raise
