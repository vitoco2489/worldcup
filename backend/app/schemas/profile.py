from pydantic import BaseModel


class UserStatsPublic(BaseModel):
    total_points: int
    correct_predictions: int
    exact_score_hits: int
