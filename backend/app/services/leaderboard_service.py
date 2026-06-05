from __future__ import annotations

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.schemas.leaderboard import LeaderboardRow


def leaderboard(db: Session, limit: int = 50) -> list[LeaderboardRow]:
    """correct_bets / incorrect_bets = resolved picks with a final score, by outcome vs result."""
    match_outcome = case(
        (Match.score_home > Match.score_away, "home"),
        (Match.score_home < Match.score_away, "away"),
        else_="draw",
    )
    has_final_score = and_(Match.score_home.isnot(None), Match.score_away.isnot(None))
    correct_pick = and_(has_final_score, Bet.prediction == match_outcome)
    incorrect_pick = and_(has_final_score, Bet.prediction != match_outcome)
    bet_counts = (
        select(
            Bet.user_id.label("user_id"),
            func.count(Bet.id).label("total_bets"),
        )
        .group_by(Bet.user_id)
        .subquery()
    )
    totals = (
        select(
            Bet.user_id.label("user_id"),
            func.coalesce(func.sum(Bet.points_awarded), 0).label("total_points"),
            func.coalesce(func.sum(case((correct_pick, 1), else_=0)), 0).label("correct_bets"),
            func.coalesce(func.sum(case((incorrect_pick, 1), else_=0)), 0).label("incorrect_bets"),
        )
        .select_from(Bet)
        .join(Match, Bet.match_id == Match.id)
        .where(Bet.resolved.is_(True))
        .group_by(Bet.user_id)
        .subquery()
    )
    stmt = (
        select(
            User.id,
            User.name,
            User.email,
            func.coalesce(totals.c.total_points, 0).label("total_points"),
            func.coalesce(totals.c.correct_bets, 0).label("correct_bets"),
            func.coalesce(totals.c.incorrect_bets, 0).label("incorrect_bets"),
            func.coalesce(bet_counts.c.total_bets, 0).label("total_bets"),
            User.entry_paid.label("entry_paid"),
        )
        .outerjoin(totals, totals.c.user_id == User.id)
        .outerjoin(bet_counts, bet_counts.c.user_id == User.id)
        .order_by(
            func.coalesce(totals.c.total_points, 0).desc(),
            func.coalesce(totals.c.correct_bets, 0).desc(),
            func.coalesce(totals.c.incorrect_bets, 0).asc(),
            User.name.asc(),
        )
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        LeaderboardRow(
            user_id=r.id,
            name=r.name,
            email=r.email,
            total_points=int(r.total_points or 0),
            correct_bets=int(r.correct_bets or 0),
            incorrect_bets=int(r.incorrect_bets or 0),
            total_bets=int(r.total_bets or 0),
            entry_paid=bool(r.entry_paid),
        )
        for r in rows
    ]
