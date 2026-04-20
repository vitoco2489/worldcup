from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MatchPublic(BaseModel):
    id: UUID
    team_home: str
    team_away: str
    team_home_code: str
    team_away_code: str
    start_time: datetime
    score_home: int | None
    score_away: int | None
    status: str

    model_config = {"from_attributes": True}


class MatchAdminUpdate(BaseModel):
    score_home: int = Field(ge=0)
    score_away: int = Field(ge=0)
    status: str = "finished"
