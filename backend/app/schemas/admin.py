from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MatchLoadItem(BaseModel):
    team_home: str = Field(min_length=1, max_length=128)
    team_away: str = Field(min_length=1, max_length=128)
    team_home_code: str = Field(min_length=2, max_length=8)
    team_away_code: str = Field(min_length=2, max_length=8)
    start_time: datetime


class MatchLoadResponse(BaseModel):
    created: int
    skipped: int


class ScheduleLoadRequest(BaseModel):
    name: str = "World Cup 2026"
    matches: list[dict]
    replace_existing: bool = False


class ScheduleLoadResponse(BaseModel):
    tournament: str
    created: int
    skipped: int
    bracket_slots_updated: int = 0
    error_count: int
    errors: list[str]


class CsvRowError(BaseModel):
    row: int
    message: str


class MatchLoadCsvResponse(BaseModel):
    created: int
    skipped: int
    errors: list[CsvRowError]


class PoolUpdateRequest(BaseModel):
    pool_total: int = Field(ge=0, description="Prize pool total in whole USD")


class SimulateMatchRequest(BaseModel):
    match_id: UUID
    score_home: int = Field(ge=0)
    score_away: int = Field(ge=0)
    status: str = "finished"


class LockBetsResponse(BaseModel):
    bets_locked: int


class AdminUserRow(BaseModel):
    id: UUID
    name: str
    email: str
    entry_paid: bool


class EntryPaidUpdate(BaseModel):
    entry_paid: bool


class SimulateBetRequest(BaseModel):
    user_id: UUID
    match_id: UUID
    score_home: int = Field(ge=0)
    score_away: int = Field(ge=0)


class ResetSimulationResponse(BaseModel):
    bets_deleted_new: int
    bets_restored: int
    matches_restored: int


class SimulateTimeRequest(BaseModel):
    current_time: datetime


class ServerTimeResponse(BaseModel):
    now: datetime
    is_simulated: bool


class ResetAllDataRequest(BaseModel):
    confirm: str


class ResetAllDataResponse(BaseModel):
    bets_deleted: int
    matches_reset: int
    simulation_snapshots_deleted: int


class ResetBetsRequest(BaseModel):
    confirm: str


class ResetBetsResponse(BaseModel):
    bets_deleted: int


class ResetMatchesRequest(BaseModel):
    confirm: str


class ResetMatchesResponse(BaseModel):
    bets_deleted: int
    matches_deleted: int
    simulation_snapshots_deleted: int


class MatchResultUpdateItem(BaseModel):
    match_id: UUID
    score_home: int = Field(ge=0)
    score_away: int = Field(ge=0)
    status: str = "finished"


class MatchResultUpdateRequest(BaseModel):
    match_id: UUID
    score_home: int = Field(ge=0)
    score_away: int = Field(ge=0)
    status: str = "finished"


class MatchResultUpdateResponse(BaseModel):
    match_id: UUID
    message: str


class MatchResultsBulkUpdateRequest(BaseModel):
    updates: list[MatchResultUpdateItem]


class MatchResultsBulkUpdateResponse(BaseModel):
    updated: int
    message: str


class FinishedMatchBetRow(BaseModel):
    user_name: str
    predicted_outcome: str | None
    predicted_score: str | None
    result_indicator: str  # "correct" | "incorrect" | "no_bet"
    points_earned: int


class FinishedMatchTable(BaseModel):
    match_id: UUID
    team_home: str
    team_away: str
    team_home_code: str
    team_away_code: str
    start_time: datetime
    score_home: int
    score_away: int
    rows: list[FinishedMatchBetRow]


class AllowedEmailRow(BaseModel):
    email: str
    note: str | None = None
    created_at: datetime
    is_admin: bool = False


class AllowedEmailCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    note: str | None = Field(default=None, max_length=128)


class UrgentMatchSummary(BaseModel):
    match_id: UUID
    team_home: str
    team_away: str
    start_time: datetime
    minutes_until_start: int


class UserMissingUrgentBets(BaseModel):
    user_id: UUID
    name: str
    email: str
    missing_match_labels: list[str]


class WhatsAppReminderResponse(BaseModel):
    hours_window: int
    app_url: str
    urgent_matches: list[UrgentMatchSummary]
    users_missing: list[UserMissingUrgentBets]
    message: str
