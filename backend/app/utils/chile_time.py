from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

CL = ZoneInfo("America/Santiago")


def chile_day_utc_bounds(date_key: str) -> tuple[datetime, datetime]:
    """UTC range [start, end) for a calendar day in Chile."""
    d = date.fromisoformat(date_key)
    start_cl = datetime.combine(d, time.min, tzinfo=CL)
    end_cl = start_cl + timedelta(days=1)
    return start_cl.astimezone(timezone.utc), end_cl.astimezone(timezone.utc)


def chile_today_key(now: datetime) -> str:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(CL)
    return local.date().isoformat()
