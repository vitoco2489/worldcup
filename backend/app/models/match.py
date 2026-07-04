from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_home: Mapped[str] = mapped_column(String(128), nullable=False)
    team_away: Mapped[str] = mapped_column(String(128), nullable=False)
    team_home_code: Mapped[str] = mapped_column(String(8), nullable=False)
    team_away_code: Mapped[str] = mapped_column(String(8), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    penalty_score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    penalty_score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled", index=True)
    round: Mapped[str | None] = mapped_column(String(64), nullable=True)
    group_name: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    ground: Mapped[str | None] = mapped_column(String(128), nullable=True)
    match_number: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True, index=True)
    teams_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    bets: Mapped[list["Bet"]] = relationship("Bet", back_populates="match")
