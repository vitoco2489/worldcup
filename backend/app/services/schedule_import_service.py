from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.utils.schedule_time import parse_schedule_datetime
from app.utils.team_codes import is_placeholder_team, team_display_code


def _parse_match_row(raw: dict) -> dict:
    team1 = (raw.get("team1") or "").strip()
    team2 = (raw.get("team2") or "").strip()
    if not team1 or not team2:
        raise ValueError("team1 and team2 are required")
    start_time = parse_schedule_datetime(raw["date"], raw["time"])
    group = raw.get("group")
    group_name = group.strip() if isinstance(group, str) and group.strip() else None
    num = raw.get("num")
    match_number = int(num) if num is not None else None
    return {
        "team_home": team1,
        "team_away": team2,
        "team_home_code": team_display_code(team1),
        "team_away_code": team_display_code(team2),
        "start_time": start_time,
        "round": (raw.get("round") or "").strip() or None,
        "group_name": group_name,
        "ground": (raw.get("ground") or "").strip() or None,
        "match_number": match_number,
        "teams_resolved": not (is_placeholder_team(team1) or is_placeholder_team(team2)),
    }


def load_schedule_payload(
    db: Session,
    payload: dict,
    *,
    replace_existing: bool = False,
) -> dict[str, int]:
    name = (payload.get("name") or "schedule").strip()
    rows = payload.get("matches")
    if not isinstance(rows, list):
        raise ValueError("Payload must include 'matches' array")

    if replace_existing:
        db.execute(delete(Bet))
        db.execute(delete(Match))
        db.flush()

    created = 0
    skipped = 0
    errors: list[str] = []

    for i, raw in enumerate(rows, start=1):
        if not isinstance(raw, dict):
            errors.append(f"Row {i}: not an object")
            continue
        try:
            parsed = _parse_match_row(raw)
        except Exception as e:
            errors.append(f"Row {i}: {e}")
            continue

        existing = None
        if parsed["match_number"] is not None:
            existing = db.scalar(
                select(Match).where(Match.match_number == parsed["match_number"])
            )
        if existing is None:
            existing = db.scalars(
                select(Match).where(
                    Match.team_home == parsed["team_home"],
                    Match.team_away == parsed["team_away"],
                    Match.start_time == parsed["start_time"],
                )
            ).first()

        if existing:
            skipped += 1
            continue

        db.add(
            Match(
                id=uuid.uuid4(),
                status="scheduled",
                score_home=None,
                score_away=None,
                **parsed,
            )
        )
        created += 1

    db.flush()
    return {
        "tournament": name,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "error_count": len(errors),
    }
