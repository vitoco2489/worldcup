from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.bet import Bet
from app.models.user import User
from app.schemas.pool import PoolPublic
from app.services.admin_ops_service import get_or_create_pool_settings


def get_pool(db: Session) -> PoolPublic:
    settings = get_settings()
    row = get_or_create_pool_settings(db)
    pool_total = row.pool_total_usd
    if pool_total > 0:
        prize_display_usd = f"${pool_total:,}"
    else:
        prize_display_usd = settings.prize_pool_amount_usd or "—"

    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_bets = db.scalar(select(func.count()).select_from(Bet)) or 0
    total_points = (
        db.scalar(select(func.coalesce(func.sum(Bet.points_awarded), 0)).where(Bet.resolved.is_(True))) or 0
    )
    return PoolPublic(
        label=settings.prize_pool_label,
        prize_display_usd=prize_display_usd,
        pool_total_usd=int(pool_total),
        total_users=int(total_users),
        total_bets_placed=int(total_bets),
        total_points_awarded=int(total_points),
    )
