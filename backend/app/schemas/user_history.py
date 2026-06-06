from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserBetHistoryItem(BaseModel):
    bet_id: UUID
    match_id: UUID
    team_home: str
    team_away: str
    team_home_code: str
    team_away_code: str
    start_time: datetime
    score_home: int | None
    score_away: int | None
    match_finished: bool
    prediction: str
    predicted_score_home: int | None
    predicted_score_away: int | None
    resolved: bool
    points_awarded: int | None
    correct: bool | None
    exact_score_hit: bool | None


class UserBetHistoryPublic(BaseModel):
    user_id: UUID
    name: str
    total_points: int
    correct_predictions: int
    incorrect_predictions: int
    exact_score_hits: int
    total_bets: int
    resolved: list[UserBetHistoryItem]
    pending: list[UserBetHistoryItem]
