from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.schemas.social import WallEntry, WallHighlights


def _match_label(m: Match) -> str:
    return f"{m.team_home} vs {m.team_away}"


def _final(m: Match) -> str:
    return f"{m.score_home}-{m.score_away}"


def wall_highlights(db: Session, *, limit: int = 12) -> WallHighlights:
    stmt = (
        select(Bet, Match, User)
        .join(Match, Bet.match_id == Match.id)
        .join(User, User.id == Bet.user_id)
        .where(
            Bet.resolved.is_(True),
            Match.score_home.is_not(None),
            Match.score_away.is_not(None),
        )
    )
    fame: list[WallEntry] = []
    shame: list[WallEntry] = []

    for bet, m, user in db.execute(stmt).all():
        final = _final(m)
        pred_score = (
            f"{bet.predicted_score_home}-{bet.predicted_score_away}"
            if bet.predicted_score_home is not None and bet.predicted_score_away is not None
            else None
        )
        label = _match_label(m)
        pts = int(bet.points_awarded or 0)

        if bet.exact_score_hit:
            fame.append(
                WallEntry(
                    user_name=user.name,
                    match_label=label,
                    team_home_code=m.team_home_code,
                    team_away_code=m.team_away_code,
                    predicted_score=pred_score,
                    final_score=final,
                    points_earned=pts,
                    detail="Marcador exacto",
                )
            )
        elif pts >= 3 and bet.correct:
            fame.append(
                WallEntry(
                    user_name=user.name,
                    match_label=label,
                    team_home_code=m.team_home_code,
                    team_away_code=m.team_away_code,
                    predicted_score=pred_score,
                    final_score=final,
                    points_earned=pts,
                    detail="Resultado acertado",
                )
            )

        if pred_score is not None:
            err = abs(bet.predicted_score_home - m.score_home) + abs(bet.predicted_score_away - m.score_away)
            if not bet.exact_score_hit and err >= 4:
                shame.append(
                    WallEntry(
                        user_name=user.name,
                        match_label=label,
                        team_home_code=m.team_home_code,
                        team_away_code=m.team_away_code,
                        predicted_score=pred_score,
                        final_score=final,
                        points_earned=pts,
                        detail=f"Lejos {err} goles del real",
                    )
                )
            elif not bet.correct and pred_score in ("4-0", "0-4", "3-0", "0-3") and m.score_home == m.score_away:
                shame.append(
                    WallEntry(
                        user_name=user.name,
                        match_label=label,
                        team_home_code=m.team_home_code,
                        team_away_code=m.team_away_code,
                        predicted_score=pred_score,
                        final_score=final,
                        points_earned=pts,
                        detail="Soñó goleada, hubo empate",
                    )
                )
        elif not bet.correct and pts == 0:
            shame.append(
                WallEntry(
                    user_name=user.name,
                    match_label=label,
                    team_home_code=m.team_home_code,
                    team_away_code=m.team_away_code,
                    predicted_score=None,
                    final_score=final,
                    points_earned=0,
                    detail="1×2 fallado",
                )
            )

    fame.sort(key=lambda e: (-e.points_earned, e.user_name))
    shame.sort(key=lambda e: (-len(e.detail), e.user_name))

    def dedupe(entries: list[WallEntry]) -> list[WallEntry]:
        seen: set[tuple[str, str]] = set()
        out: list[WallEntry] = []
        for e in entries:
            key = (e.user_name, e.match_label)
            if key in seen:
                continue
            seen.add(key)
            out.append(e)
        return out

    return WallHighlights(
        fame=dedupe(fame)[:limit],
        shame=dedupe(shame)[:limit],
    )
