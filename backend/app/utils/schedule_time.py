from __future__ import annotations

import re
from datetime import date, datetime, time, timezone, timedelta

_TIME_RE = re.compile(
    r"^(\d{1,2}):(\d{2})\s*UTC([+-])(\d{1,2})$",
    re.IGNORECASE,
)


def parse_schedule_datetime(date_str: str, time_str: str) -> datetime:
    """e.g. date 2026-06-11, time '13:00 UTC-6' -> UTC aware datetime."""
    d = date.fromisoformat(date_str.strip())
    m = _TIME_RE.match((time_str or "").strip())
    if not m:
        raise ValueError(f"Invalid time format: {time_str!r} (expected HH:MM UTC±N)")
    hour, minute, sign, offset_h = int(m.group(1)), int(m.group(2)), m.group(3), int(m.group(4))
    local_offset = offset_h if sign == "+" else -offset_h
    local_tz = timezone(timedelta(hours=local_offset))
    local_dt = datetime.combine(d, time(hour, minute), tzinfo=local_tz)
    return local_dt.astimezone(timezone.utc)
