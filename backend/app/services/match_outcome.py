from __future__ import annotations

from fastapi import HTTPException

from app.models.match import Match


def is_knockout_match(match: Match) -> bool:
    return match.group_name is None


def has_penalty_winner(match: Match) -> bool:
    if match.penalty_score_home is None or match.penalty_score_away is None:
        return False
    return match.penalty_score_home != match.penalty_score_away


def knockout_needs_penalties(match: Match) -> bool:
    if not is_knockout_match(match):
        return False
    if match.score_home is None or match.score_away is None:
        return False
    return match.score_home == match.score_away and not has_penalty_winner(match)


def match_winner_team(match: Match) -> str | None:
    if match.score_home is None or match.score_away is None:
        return None
    if match.score_home > match.score_away:
        return match.team_home
    if match.score_away > match.score_home:
        return match.team_away
    if not is_knockout_match(match):
        return None
    if not has_penalty_winner(match):
        return None
    if match.penalty_score_home > match.penalty_score_away:
        return match.team_home
    return match.team_away


def match_betting_outcome(match: Match) -> str | None:
    """Pool points from stored score: 90' in groups, 120' in knockout; penalties never affect outcome."""
    if match.score_home is None or match.score_away is None:
        return None
    if match.score_home > match.score_away:
        return "home"
    if match.score_away > match.score_home:
        return "away"
    return "draw"


def match_outcome(match: Match) -> str | None:
    return match_betting_outcome(match)


def validate_penalty_input(
    match: Match,
    *,
    score_home: int,
    score_away: int,
    penalty_score_home: int | None,
    penalty_score_away: int | None,
) -> tuple[int | None, int | None]:
    has_pen = penalty_score_home is not None or penalty_score_away is not None
    if has_pen and (penalty_score_home is None or penalty_score_away is None):
        raise HTTPException(status_code=400, detail="Provide both penalty scores or omit both")
    if penalty_score_home is not None:
        if penalty_score_home < 0 or penalty_score_away < 0:
            raise HTTPException(status_code=400, detail="Penalty scores must be non-negative integers")
        if penalty_score_home == penalty_score_away:
            raise HTTPException(status_code=400, detail="Penalty shootout must have a winner")
    if is_knockout_match(match) and score_home == score_away:
        if penalty_score_home is None or penalty_score_away is None:
            raise HTTPException(
                status_code=400,
                detail="Knockout draw requires penalty shootout scores (e.g. 4-3)",
            )
        return penalty_score_home, penalty_score_away
    return None, None


def format_score_line(match: Match) -> str | None:
    if match.score_home is None or match.score_away is None:
        return None
    base = f"{match.score_home}-{match.score_away}"
    if has_penalty_winner(match):
        return f"{base} ({match.penalty_score_home}-{match.penalty_score_away} pen)"
    return base
