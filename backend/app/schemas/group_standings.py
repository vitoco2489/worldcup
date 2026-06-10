from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

QualificationStatus = Literal["direct", "best_third"]


class TeamStandingRow(BaseModel):
    team: str
    team_code: str
    played: int
    wins: int
    draws: int
    losses: int
    gf: int
    ga: int
    gd: int
    points: int
    qualification: QualificationStatus | None = None


class GroupStandingsTable(BaseModel):
    group_name: str
    group_letter: str
    rows: list[TeamStandingRow]


class GroupStandingsView(BaseModel):
    groups: list[GroupStandingsTable]
    best_third_slots: int = 8
