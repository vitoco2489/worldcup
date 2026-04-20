from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.simulated_clock import SIMULATED_CLOCK_ROW_ID, SimulatedClock


def set_simulated_at(db: Session, at: datetime) -> None:
    row = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
    if row is None:
        row = SimulatedClock(id=SIMULATED_CLOCK_ROW_ID, simulated_at=at)
        db.add(row)
    else:
        row.simulated_at = at
    db.flush()


def clear_simulated_at(db: Session) -> None:
    row = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
    if row is not None:
        row.simulated_at = None
    db.flush()
