from pydantic import BaseModel


class PoolPublic(BaseModel):
    label: str
    prize_display_usd: str
    pool_total_usd: int
    total_users: int
    total_bets_placed: int
    total_points_awarded: int
