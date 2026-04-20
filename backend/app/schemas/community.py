from pydantic import BaseModel

from app.schemas.match import MatchPublic


class PredictionCounts(BaseModel):
    home: int
    draw: int
    away: int


class CommunityMatchRow(BaseModel):
    match: MatchPublic
    counts: PredictionCounts
    reveal_individuals: bool
    individuals: dict[str, list[str]] | None = None
