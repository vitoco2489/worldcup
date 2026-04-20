"""Outcome vs predicted score consistency (1X2 vs exact score line)."""


def validate_outcome_vs_scores(prediction: str, home: int | None, away: int | None) -> None:
    """Raises ValueError with message if scores are set but inconsistent with prediction."""
    if home is None or away is None:
        return
    if prediction == "home" and not (home > away):
        raise ValueError("Home win prediction requires home score greater than away score")
    if prediction == "away" and not (away > home):
        raise ValueError("Away win prediction requires away score greater than home score")
    if prediction == "draw" and home != away:
        raise ValueError("Draw prediction requires equal home and away scores")


def implied_outcome_from_scores(home: int, away: int) -> str:
    if home > away:
        return "home"
    if away > home:
        return "away"
    return "draw"
