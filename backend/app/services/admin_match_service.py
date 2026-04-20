from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.schemas.admin import MatchLoadItem


def _normalize_start_time(st: datetime) -> datetime:
    if st.tzinfo is None:
        return st.replace(tzinfo=timezone.utc)
    return st


def insert_match_if_new(db: Session, item: MatchLoadItem) -> str:
    """Returns 'created' or 'skipped'."""
    st = _normalize_start_time(item.start_time)
    th = item.team_home.strip()
    ta = item.team_away.strip()
    existing = db.scalars(
        select(Match).where(
            Match.team_home == th,
            Match.team_away == ta,
            Match.start_time == st,
        )
    ).first()
    if existing:
        return "skipped"
    db.add(
        Match(
            id=uuid.uuid4(),
            team_home=th,
            team_away=ta,
            team_home_code=item.team_home_code.strip().lower(),
            team_away_code=item.team_away_code.strip().lower(),
            start_time=st,
            score_home=None,
            score_away=None,
            status="scheduled",
        )
    )
    return "created"


def load_matches_from_payload(db: Session, items: list[MatchLoadItem]) -> tuple[int, int]:
    created = 0
    skipped = 0
    for item in items:
        if insert_match_if_new(db, item) == "created":
            created += 1
        else:
            skipped += 1
    db.flush()
    return created, skipped


def _parse_csv_start_time(raw: str) -> datetime:
    s = (raw or "").strip()
    if not s:
        raise ValueError("start_time is required")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _row_to_match_item(row: dict[str, str]) -> MatchLoadItem:
    def g(key: str) -> str:
        # case-insensitive key lookup
        lower = {k.strip().lower().lstrip("\ufeff"): (v or "").strip() for k, v in row.items()}
        if key.lower() not in lower:
            raise ValueError(f"Missing column {key}")
        return lower[key.lower()]

    return MatchLoadItem(
        team_home=g("team_home"),
        team_away=g("team_away"),
        team_home_code=g("team_home_code"),
        team_away_code=g("team_away_code"),
        start_time=_parse_csv_start_time(g("start_time")),
    )


def load_matches_from_csv_text(db: Session, text: str) -> tuple[int, int, list[dict]]:
    """Returns created, skipped, errors as list of {row: int, message: str}."""
    created = 0
    skipped = 0
    errors: list[dict] = []
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return 0, 0, [{"row": 0, "message": "CSV has no header row"}]

    for i, row in enumerate(reader, start=2):
        if not row or all(not (v or "").strip() for v in row.values()):
            continue
        try:
            item = _row_to_match_item(row)
        except Exception as e:
            errors.append({"row": i, "message": str(e)})
            continue
        try:
            result = insert_match_if_new(db, item)
            if result == "created":
                created += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append({"row": i, "message": str(e)})
    db.flush()
    return created, skipped, errors
