from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.match import Match
from app.services import group_standings_service
from app.utils.team_codes import team_display_code

# R32 fixtures where a group winner plays a best third (FIFA Art. 12.6 / Annex C).
MATCH_THIRD_WINNER_LETTER: dict[int, str] = {
    74: "E",  # Germany
    77: "I",
    79: "A",  # Mexico
    80: "L",
    81: "D",  # USA
    82: "G",
    85: "B",  # Switzerland
    87: "K",
}

_ANNEX_PATH = Path(__file__).resolve().parent.parent / "data" / "third_place_annex_c.json"


@lru_cache
def _annex_index() -> tuple[list[str], dict[str, str]]:
    data = json.loads(_ANNEX_PATH.read_text(encoding="utf-8"))
    winners: list[str] = data["winners"]
    rows: list[str] = data["rows"]
    index: dict[str, str] = {}
    for row in rows:
        if len(row) != len(winners):
            continue
        key = "".join(sorted(row))
        index[key] = row
    return winners, index


def _qualifying_third_group_letters(db: Session) -> set[str]:
    groups = group_standings_service.build_all_group_standings(db)
    best = group_standings_service.best_third_qualifiers(groups)
    letters: set[str] = set()
    for group_name, _team in best:
        letter = group_name.strip()[-1].upper()
        if letter in "ABCDEFGHIJKL":
            letters.add(letter)
    return letters


def _winner_letter_for_match(match: Match) -> str | None:
    if match.match_number in MATCH_THIRD_WINNER_LETTER:
        return MATCH_THIRD_WINNER_LETTER[match.match_number]
    home = match.team_home.strip().upper()
    if len(home) == 2 and home[0] == "1" and home[1] in "ABCDEFGHIJKL":
        return home[1]
    return None


def resolve_third_for_match(db: Session, match: Match) -> tuple[str, str] | None:
    """Resolve which best third-placed team faces this group winner (FIFA Annex C)."""
    winner_letter = _winner_letter_for_match(match)
    if not winner_letter:
        return None

    qualifying = _qualifying_third_group_letters(db)
    if len(qualifying) != 8:
        return None

    winners, index = _annex_index()
    row = index.get("".join(sorted(qualifying)))
    if not row:
        return None

    try:
        col = winners.index(winner_letter)
    except ValueError:
        return None

    third_group_letter = row[col]
    group_name = f"Group {third_group_letter}"
    table = group_standings_service.compute_group_table(db, group_name)
    if len(table) < 3:
        return None

    best = group_standings_service.best_third_qualifiers(
        group_standings_service.build_all_group_standings(db)
    )
    third = table[2]
    if (group_name, third.team) not in best:
        return None

    return third.team, team_display_code(third.team)
