from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.utils.schedule_time import parse_schedule_datetime
from app.utils.team_codes import is_placeholder_team, team_display_code

BUNDLED_SCHEDULE_PATH = Path(__file__).resolve().parents[2] / "data" / "world_cup_2026_schedule.json"


def _normalize_group_name(raw: str | None) -> str | None:
    if raw is None:
        return None
    g = raw.strip()
    if not g:
        return None
    upper = g.upper()
    if upper.startswith("GROUP ") or upper.startswith("GRUPO "):
        parts = g.split()
        letter = parts[-1] if parts else ""
        if len(letter) == 1 and letter.upper() in "ABCDEFGHIJKL":
            return f"Group {letter.upper()}"
        return g
    if len(g) == 1 and g.upper() in "ABCDEFGHIJKL":
        return f"Group {g.upper()}"
    return g


def _parse_match_row(raw: dict) -> dict:
    team1 = (raw.get("team1") or "").strip()
    team2 = (raw.get("team2") or "").strip()
    if not team1 or not team2:
        raise ValueError("team1 and team2 are required")
    start_time = parse_schedule_datetime(raw["date"], raw["time"])
    group_raw = raw.get("group") or raw.get("grupo") or raw.get("Group")
    group_name = _normalize_group_name(group_raw.strip() if isinstance(group_raw, str) else None)
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
) -> dict[str, int]:
    name = (payload.get("name") or "schedule").strip()
    rows = payload.get("matches")
    if not isinstance(rows, list):
        raise ValueError("Payload must include 'matches' array")

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


def load_bundled_schedule_payload() -> dict:
    if not BUNDLED_SCHEDULE_PATH.is_file():
        raise FileNotFoundError(f"Bundled schedule not found: {BUNDLED_SCHEDULE_PATH}")
    return json.loads(BUNDLED_SCHEDULE_PATH.read_text(encoding="utf-8"))


def repair_schedule_pairings(db: Session, payload: dict) -> dict[str, int]:
    """Sync team placeholders and metadata from canonical schedule by match_number."""
    rows = payload.get("matches")
    if not isinstance(rows, list):
        raise ValueError("Payload must include 'matches' array")

    updated = 0
    for i, raw in enumerate(rows, start=1):
        if not isinstance(raw, dict):
            continue
        try:
            parsed = _parse_match_row(raw)
        except Exception:
            continue
        match_number = parsed["match_number"]
        if match_number is None:
            continue
        existing = db.scalar(select(Match).where(Match.match_number == match_number))
        if not existing or existing.score_home is not None or existing.score_away is not None:
            continue

        changed = False
        for field in (
            "team_home",
            "team_away",
            "team_home_code",
            "team_away_code",
            "start_time",
            "round",
            "group_name",
            "ground",
        ):
            new_value = parsed[field]
            if getattr(existing, field) != new_value:
                setattr(existing, field, new_value)
                changed = True

        teams_resolved = not (
            is_placeholder_team(existing.team_home) or is_placeholder_team(existing.team_away)
        )
        if existing.teams_resolved != teams_resolved:
            existing.teams_resolved = teams_resolved
            changed = True

        if changed:
            updated += 1

    db.flush()
    return {"updated": updated}
