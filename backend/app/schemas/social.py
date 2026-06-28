from __future__ import annotations

from pydantic import BaseModel

from app.schemas.community import PredictionCounts
from app.schemas.match import MatchPublic


class DailyDigest(BaseModel):
    date: str
    messages: list[str]


class BracketMatchRow(BaseModel):
    match: MatchPublic
    counts: PredictionCounts
    popular_prediction: str | None
    popular_pct: int
    bet_count: int


class BracketRound(BaseModel):
    round: str
    matches: list[BracketMatchRow]


class BracketView(BaseModel):
    rounds: list[BracketRound]
    active_round: str | None = None


class WallEntry(BaseModel):
    user_name: str
    match_label: str
    team_home_code: str
    team_away_code: str
    predicted_score: str | None
    final_score: str | None
    points_earned: int
    detail: str


class WallHighlights(BaseModel):
    fame: list[WallEntry]
    shame: list[WallEntry]
