from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.simulated_clock import SIMULATED_CLOCK_ROW_ID, SimulatedClock
from app.schemas.admin import ServerTimeResponse
from app.utils.time import get_current_time

router = APIRouter(tags=["time"])


@router.get("/time", response_model=ServerTimeResponse)
def read_server_time(db: Session = Depends(get_db)):
    now = get_current_time(db=db)
    row = db.get(SimulatedClock, SIMULATED_CLOCK_ROW_ID)
    simulated = row is not None and row.simulated_at is not None
    return ServerTimeResponse(now=now, is_simulated=simulated)
