from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.group_standings import GroupStandingsTable, GroupStandingsView, TeamStandingRow
from app.schemas.social import BracketView, DailyDigest, WallHighlights
from app.services import bracket_service, digest_service, group_standings_service, wall_service
from app.utils.chile_time import chile_today_key
from app.utils.time import get_current_time

router = APIRouter(tags=["social"])


@router.get("/digest/daily", response_model=DailyDigest)
def daily_digest(
    date: str | None = Query(None, description="YYYY-MM-DD in Chile"),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    key = date or chile_today_key(get_current_time(db=db))
    return digest_service.daily_digest(db, key)


@router.get("/groups/standings", response_model=GroupStandingsView)
def group_standings(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    raw = group_standings_service.build_all_group_standings(db)
    best_thirds = group_standings_service.best_third_qualifiers(raw)
    groups = []
    for name, letter, rows in raw:
        groups.append(
            GroupStandingsTable(
                group_name=name,
                group_letter=letter,
                rows=[
                    TeamStandingRow(
                        team=r.team,
                        team_code=r.team_code,
                        played=r.played,
                        wins=r.wins,
                        draws=r.draws,
                        losses=r.losses,
                        gf=r.gf,
                        ga=r.ga,
                        gd=r.gd,
                        points=r.points,
                        qualification=group_standings_service.row_qualification(
                            rank=idx + 1,
                            group_name=name,
                            team=r.team,
                            played=r.played,
                            best_thirds=best_thirds,
                        ),
                    )
                    for idx, r in enumerate(rows)
                ],
            )
        )
    return GroupStandingsView(
        groups=groups,
        best_third_slots=group_standings_service.BEST_THIRD_COUNT,
    )


@router.get("/bracket", response_model=BracketView)
def bracket(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return bracket_service.bracket_view(db)


@router.get("/wall/highlights", response_model=WallHighlights)
def wall(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return wall_service.wall_highlights(db)
