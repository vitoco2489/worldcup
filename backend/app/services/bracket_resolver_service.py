from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.services.group_standings_service import slot_to_team
from app.utils.team_codes import is_placeholder_team, team_display_code

_GROUP_SLOT = re.compile(r"^[12][A-L]$", re.IGNORECASE)
_WINNER_SLOT = re.compile(r"^W(\d+)$", re.IGNORECASE)
_LOSER_SLOT = re.compile(r"^L(\d+)$", re.IGNORECASE)


def _match_winner(m: Match) -> str | None:
    if m.score_home is None or m.score_away is None:
        return None
    if m.score_home > m.score_away:
        return m.team_home
    if m.score_away > m.score_home:
        return m.team_away
    return None


def _apply_team(m: Match, side: str, name: str, code: str) -> None:
    if side == "home":
        m.team_home = name
        m.team_home_code = code
    else:
        m.team_away = name
        m.team_away_code = code


def _refresh_teams_resolved(m: Match) -> None:
    m.teams_resolved = not (
        is_placeholder_team(m.team_home) or is_placeholder_team(m.team_away)
    )


def _resolve_slot(db: Session, slot: str) -> tuple[str, str] | None:
    slot = slot.strip()
    if _GROUP_SLOT.match(slot):
        return slot_to_team(db, slot)
    wm = _WINNER_SLOT.match(slot)
    if wm:
        num = int(wm.group(1))
        ref = db.scalar(select(Match).where(Match.match_number == num))
        if not ref:
            return None
        winner = _match_winner(ref)
        if not winner or is_placeholder_team(winner):
            return None
        return winner, team_display_code(winner)
    lm = _LOSER_SLOT.match(slot)
    if lm:
        num = int(lm.group(1))
        ref = db.scalar(select(Match).where(Match.match_number == num))
        if not ref or ref.score_home is None or ref.score_away is None:
            return None
        winner = _match_winner(ref)
        if not winner:
            return None
        loser = ref.team_away if winner == ref.team_home else ref.team_home
        if is_placeholder_team(loser):
            return None
        return loser, team_display_code(loser)
    return None


def refresh_bracket(db: Session) -> int:
    """Fill knockout placeholders (1A, 2B, W73, L101, …) from group tables / results."""
    updated = 0
    pending = list(
        db.scalars(
            select(Match).where(
                Match.teams_resolved.is_(False),
                Match.score_home.is_(None),
                Match.score_away.is_(None),
            )
        ).all()
    )
    for m in pending:
        changed = False
        for side, label in (("home", m.team_home), ("away", m.team_away)):
            if not is_placeholder_team(label):
                continue
            resolved = _resolve_slot(db, label)
            if not resolved:
                continue
            name, code = resolved
            _apply_team(m, side, name, code)
            changed = True
        if changed:
            _refresh_teams_resolved(m)
            updated += 1
    db.flush()
    return updated
