from pydantic import BaseModel

from app.schemas.match import MatchPublic


class PredictionCounts(BaseModel):
    home: int
    draw: int
    away: int


class CommunityIndividualBet(BaseModel):
    name: str
    predicted_score_home: int | None = None
    predicted_score_away: int | None = None


class CommunityMatchRow(BaseModel):
    match: MatchPublic
    counts: PredictionCounts
    reveal_individuals: bool
    individuals: dict[str, list[CommunityIndividualBet]] | None = None
