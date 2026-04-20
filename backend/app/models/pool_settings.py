from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PoolSettings(Base):
    """Single-row table (id=1) for admin-editable prize pool display amount (USD, whole dollars)."""

    __tablename__ = "pool_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    pool_total_usd: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
