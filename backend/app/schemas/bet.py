from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator

from app.utils.betting_validation import implied_outcome_from_scores


class BetCreate(BaseModel):
    """When both predicted scores are set, 1×2 is derived from them (client prediction is ignored)."""

    match_id: UUID
    prediction: Literal["home", "away", "draw"]
    predicted_score_home: int | None = None
    predicted_score_away: int | None = None

    @model_validator(mode="after")
    def scores_and_outcome(self):
        h, a = self.predicted_score_home, self.predicted_score_away
        if (h is None) ^ (a is None):
            raise ValueError("Provide both predicted scores or omit both")
        if h is not None:
            if a is None or h < 0 or a < 0:
                raise ValueError("Scores must be non-negative integers")
            object.__setattr__(self, "prediction", implied_outcome_from_scores(h, a))
        return self


class BetUpdate(BaseModel):
    prediction: Literal["home", "away", "draw"]
    predicted_score_home: int | None = None
    predicted_score_away: int | None = None

    @model_validator(mode="after")
    def scores_and_outcome(self):
        h, a = self.predicted_score_home, self.predicted_score_away
        if (h is None) ^ (a is None):
            raise ValueError("Provide both predicted scores or omit both")
        if h is not None and (h < 0 or a is None or a < 0):
            raise ValueError("Scores must be non-negative integers")
        if h is not None and a is not None:
            object.__setattr__(self, "prediction", implied_outcome_from_scores(h, a))
        return self


class BetPublic(BaseModel):
    id: UUID
    user_id: UUID
    match_id: UUID
    prediction: str
    created_at: datetime
    updated_at: datetime
    locked: bool
    resolved: bool
    points_awarded: int | None
    predicted_score_home: int | None = None
    predicted_score_away: int | None = None
    editable: bool
    correct: bool | None = None
    exact_score_hit: bool | None = None

    model_config = {"from_attributes": True}
