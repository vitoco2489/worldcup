from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.utils.team_codes import is_placeholder_team

BEST_THIRD_COUNT = 8


@dataclass
class TeamStanding:
    team: str
    team_code: str
    played: int
    wins: int
    draws: int
    losses: int
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


def _empty_standing(team: str) -> TeamStanding:
    from app.utils.team_codes import team_display_code

    return TeamStanding(
        team=team,
        team_code=team_display_code(team),
        played=0,
        wins=0,
        draws=0,
        losses=0,
        points=0,
        gf=0,
        ga=0,
    )


def compute_group_table(db: Session, group_name: str) -> list[TeamStanding]:
    """Standings from finished group-stage matches only (3/1/0, GD, GF)."""
    all_matches = list(
        db.scalars(select(Match).where(Match.group_name == group_name)).all()
    )
    stats: dict[str, TeamStanding] = {}

    def ensure(team: str) -> TeamStanding:
        if team not in stats:
            stats[team] = _empty_standing(team)
        return stats[team]

    for m in all_matches:
        if not is_placeholder_team(m.team_home):
            ensure(m.team_home)
        if not is_placeholder_team(m.team_away):
            ensure(m.team_away)

    for m in all_matches:
        if m.score_home is None or m.score_away is None:
            continue
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
            th.wins += 1
            ta.losses += 1
        elif h < a:
            ta.points += 3
            ta.wins += 1
            th.losses += 1
        else:
            th.points += 1
            ta.points += 1
            th.draws += 1
            ta.draws += 1

    return sorted(
        stats.values(),
        key=lambda s: (-s.points, -s.gd, -s.gf, s.team),
    )


def _standing_rank_key(s: TeamStanding) -> tuple:
    return (-s.points, -s.gd, -s.gf, s.team)


def best_third_qualifiers(
    groups: list[tuple[str, str, list[TeamStanding]]],
) -> set[tuple[str, str]]:
    """Top 8 third-placed teams across groups (WC 2026: 12 groups → 8 best thirds)."""
    thirds: list[tuple[str, TeamStanding]] = []
    for name, _letter, table in groups:
        if len(table) >= 3:
            thirds.append((name, table[2]))
    thirds.sort(key=lambda x: _standing_rank_key(x[1]))
    return {(name, s.team) for name, s in thirds[:BEST_THIRD_COUNT]}


def row_qualification(
    *,
    rank: int,
    group_name: str,
    team: str,
    played: int,
    best_thirds: set[tuple[str, str]],
) -> str | None:
    if rank <= 2:
        return "direct"
    if rank == 3 and played > 0 and (group_name, team) in best_thirds:
        return "best_third"
    return None


def build_all_group_standings(db: Session) -> list[tuple[str, str, list[TeamStanding]]]:
    """(group_name, group_letter, rows) for every group in the schedule."""
    groups: list[tuple[str, str, list[TeamStanding]]] = []
    for name in all_group_names(db):
        letter = _group_letter(name) or name
        table = compute_group_table(db, name)
        if table:
            groups.append((name, letter, table))
    return groups


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
