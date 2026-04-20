from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.simulated_clock import SIMULATED_CLOCK_ROW_ID, SimulatedClock

LOCK_BEFORE_START = timedelta(minutes=5)


def utc_now() -> datetime:
    """Real wall-clock UTC (JWT issuance, Google login timestamps)."""
    return datetime.now(timezone.utc)


def get_current_time(*, db: Session | None = None) -> datetime:
    """Effective UTC time for betting, match lists, community reveal, and maintenance jobs."""
    if db is not None:
        row = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
        if row is not None and row.simulated_at is not None:
            return row.simulated_at
        return utc_now()
    from app.database import SessionLocal

    with SessionLocal() as s:
        return get_current_time(db=s)


def lock_time_for_match_start(start_time_utc: datetime) -> datetime:
    return start_time_utc - LOCK_BEFORE_START


def is_bet_editable(match_start_utc: datetime, *, now: datetime | None = None) -> bool:
    n = now if now is not None else get_current_time()
    return n < lock_time_for_match_start(match_start_utc)


def seconds_until_lock(match_start_utc: datetime, *, now: datetime | None = None) -> float:
    n = now if now is not None else get_current_time()
    return max(0.0, (lock_time_for_match_start(match_start_utc) - n).total_seconds())
