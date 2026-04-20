from uuid import UUID

from pydantic import BaseModel


class LeaderboardRow(BaseModel):
    user_id: UUID
    name: str
    email: str
    total_points: int
    correct_bets: int
    incorrect_bets: int
