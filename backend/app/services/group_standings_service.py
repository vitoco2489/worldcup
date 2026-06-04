from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.utils.team_codes import is_placeholder_team


@dataclass
class TeamStanding:
    team: str
    played: int
    points: int
    gf: int
    ga: int

    @property
    def gd(self) -> int:
        return self.gf - self.ga


def _group_letter(group_name: str | None) -> str | None:
    if not group_name:
        return None
    g = group_name.strip()
    if len(g) >= 1 and g[-1] in "ABCDEFGHIJKL":
        return g[-1].upper()
    return None


def compute_group_table(db: Session, group_name: str) -> list[TeamStanding]:
    """Standings from finished group-stage matches only (3/1/0, GD, GF)."""
    matches = list(
        db.scalars(
            select(Match).where(
                Match.group_name == group_name,
                Match.score_home.isnot(None),
                Match.score_away.isnot(None),
            )
        ).all()
    )
    stats: dict[str, TeamStanding] = {}

    def ensure(team: str) -> TeamStanding:
        if team not in stats:
            stats[team] = TeamStanding(team=team, played=0, points=0, gf=0, ga=0)
        return stats[team]

    for m in matches:
        if is_placeholder_team(m.team_home) or is_placeholder_team(m.team_away):
            continue
        h, a = m.score_home or 0, m.score_away or 0
        th, ta = ensure(m.team_home), ensure(m.team_away)
        th.played += 1
        ta.played += 1
        th.gf += h
        th.ga += a
        ta.gf += a
        ta.ga += h
        if h > a:
            th.points += 3
        elif h < a:
            ta.points += 3
        else:
            th.points += 1
            ta.points += 1

    return sorted(
        stats.values(),
        key=lambda s: (-s.points, -s.gd, -s.gf, s.team),
    )


def slot_to_team(db: Session, slot: str) -> tuple[str, str] | None:
    """
    Map '1A' / '2B' to (team_name, code). Returns None if group not ready.
    """
    slot = slot.strip().upper()
    if len(slot) != 2 or slot[0] not in "12":
        return None
    letter = slot[1]
    group_name = f"Group {letter}"
    table = compute_group_table(db, group_name)
    if len(table) < 2:
        return None
    idx = 0 if slot[0] == "1" else 1
    if len(table) <= idx:
        return None
    from app.utils.team_codes import team_display_code

    team = table[idx].team
    return team, team_display_code(team)


def all_group_names(db: Session) -> list[str]:
    rows = db.scalars(
        select(Match.group_name)
        .where(Match.group_name.isnot(None))
        .distinct()
        .order_by(Match.group_name)
    ).all()
    return [r for r in rows if r]
