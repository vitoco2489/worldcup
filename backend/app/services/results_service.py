from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.services.bet_service import match_result_prediction


def list_finished_match_tables(db: Session) -> list[dict]:
    users = list(db.scalars(select(User).order_by(User.name.asc())).all())
    finished_matches = list(
        db.scalars(
            select(Match)
            .where(Match.score_home.is_not(None), Match.score_away.is_not(None))
            .order_by(Match.start_time.desc())
        ).all()
    )
    out: list[dict] = []
    for m in finished_matches:
        bets = list(db.scalars(select(Bet).where(Bet.match_id == m.id)).all())
        by_user = {str(b.user_id): b for b in bets}
        final_outcome = match_result_prediction(m)
        rows: list[dict] = []
        for u in users:
            b = by_user.get(str(u.id))
            if b is None:
                rows.append(
                    {
                        "user_name": u.name,
                        "predicted_outcome": None,
                        "predicted_score": None,
                        "result_indicator": "no_bet",
                        "points_earned": 0,
                    }
                )
                continue
            predicted_score = (
                f"{b.predicted_score_home}-{b.predicted_score_away}"
                if b.predicted_score_home is not None and b.predicted_score_away is not None
                else None
            )
            indicator = "incorrect"
            if final_outcome is not None and b.prediction == final_outcome:
                indicator = "correct"
            rows.append(
                {
                    "user_name": u.name,
                    "predicted_outcome": b.prediction,
                    "predicted_score": predicted_score,
                    "result_indicator": indicator,
                    "points_earned": int(b.points_awarded or 0),
                }
            )
        rows.sort(key=lambda r: (-r["points_earned"], r["user_name"].lower()))
        out.append(
            {
                "match_id": m.id,
                "team_home": m.team_home,
                "team_away": m.team_away,
                "team_home_code": m.team_home_code,
                "team_away_code": m.team_away_code,
                "start_time": m.start_time,
                "score_home": int(m.score_home),
                "score_away": int(m.score_away),
                "penalty_score_home": m.penalty_score_home,
                "penalty_score_away": m.penalty_score_away,
                "match_number": m.match_number,
                "round": m.round,
                "group_name": m.group_name,
                "rows": rows,
            }
        )
    return out

