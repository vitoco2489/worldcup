from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SimulationMatchSnapshot(Base):
    """Stores pre-simulation match row so reset can restore."""

    __tablename__ = "simulation_match_snapshots"

    match_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matches.id"), primary_key=True)
    score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)


class SimulationBetSnapshot(Base):
    """Per-bet state before simulation; is_new=True means delete bet on reset."""

    __tablename__ = "simulation_bet_snapshots"

    bet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bets.id"), primary_key=True)
    is_new: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False)
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False)
    prediction: Mapped[str] = mapped_column(String(16), nullable=False)
    predicted_score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    predicted_score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
