from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

SIMULATED_CLOCK_ROW_ID = 1


class SimulatedClock(Base):
    """Single-row table: when `simulated_at` is set, it is the effective UTC 'now' for pool logic."""

    __tablename__ = "simulated_clock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    simulated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
